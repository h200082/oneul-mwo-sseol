export const MIN_ROOM_PLAYERS = 2;
export const MAX_ROOM_PLAYERS = 8;
export const MAX_NICKNAME_LENGTH = 16;
export const ROOM_CODE_LENGTH = 8;

/**
 * Uppercase letters and digits with 0, 1, I, L, and O removed so a room code
 * remains easy to read aloud and type from another player's screen.
 */
export const ROOM_CODE_ALPHABET =
  "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type MealTime = "lunch" | "dinner";
export type RoomStatus = "waiting" | "started";
export type RoomPlayerRole = "host" | "member";
export type RoomRandomSource = () => number;
export type RoomDeckSeed = number | string;

export type RoomDomainErrorCode =
  | "INVALID_MEAL_TIME"
  | "INVALID_PLAYER_ID"
  | "INVALID_NICKNAME"
  | "INVALID_RANDOM_VALUE"
  | "DUPLICATE_PLAYER_ID"
  | "PLAYER_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_ALREADY_STARTED"
  | "HOST_ONLY"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_DECK_SEED"
  | "INVALID_CONTENT_VERSION"
  | "INVALID_START_AT";

export class RoomDomainError extends Error {
  readonly code: RoomDomainErrorCode;

  constructor(code: RoomDomainErrorCode, message: string) {
    super(message);
    this.name = "RoomDomainError";
    this.code = code;
  }
}

export interface RoomPlayerInput {
  readonly playerId: string;
  readonly nickname: string;
}

export interface RoomPlayer {
  readonly playerId: string;
  readonly nickname: string;
  readonly role: RoomPlayerRole;
  readonly rosterOrder: number;
}

interface RoomBase {
  readonly code: string;
  readonly mealTime: MealTime;
  readonly hostPlayerId: string;
  readonly players: readonly RoomPlayer[];
}

export interface WaitingRoom extends RoomBase {
  readonly status: "waiting";
  readonly start: null;
}

export interface RoomStartSnapshot {
  /**
   * All clients use this one seed to reproduce the same menu deck.
   */
  readonly deckSeed: RoomDeckSeed;
  readonly contentVersion: string;
  /**
   * Shared Unix timestamp in milliseconds.
   */
  readonly startAt: number;
  /**
   * Immutable roster in the exact order used by the game and result screen.
   */
  readonly roster: readonly RoomPlayer[];
}

export interface StartedRoom extends RoomBase {
  readonly status: "started";
  readonly start: Readonly<RoomStartSnapshot>;
}

export type Room = WaitingRoom | StartedRoom;

export interface CreateRoomOptions extends RoomPlayerInput {
  readonly mealTime: MealTime;
  readonly rng?: RoomRandomSource;
}

export interface StartRoomOptions {
  readonly requesterPlayerId: string;
  readonly deckSeed: RoomDeckSeed;
  readonly contentVersion: string;
  readonly startAt: number;
}

/**
 * Produces the nickname shown in the lobby and result screen.
 *
 * Compatibility normalization folds visually equivalent full-width characters,
 * leading/trailing whitespace is removed, and internal whitespace is collapsed.
 * Nicknames do not need to be unique because player ids provide identity.
 */
export function normalizeNickname(nickname: string): string {
  if (typeof nickname !== "string") {
    throw roomError(
      "INVALID_NICKNAME",
      "A nickname must be a string.",
    );
  }

  const normalized = nickname
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ");

  if (normalized.length === 0) {
    throw roomError(
      "INVALID_NICKNAME",
      "A nickname must contain at least one visible character.",
    );
  }

  if (normalized.length > MAX_NICKNAME_LENGTH) {
    throw roomError(
      "INVALID_NICKNAME",
      `A nickname must contain at most ${MAX_NICKNAME_LENGTH} characters.`,
    );
  }

  return normalized;
}

/**
 * Generates an eight-character room code using an injectable random source.
 * Injecting the RNG makes code creation deterministic in tests.
 */
export function generateRoomCode(
  rng: RoomRandomSource = Math.random,
): string {
  let code = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const randomValue = rng();
    if (
      !Number.isFinite(randomValue) ||
      randomValue < 0 ||
      randomValue >= 1
    ) {
      throw roomError(
        "INVALID_RANDOM_VALUE",
        `A room-code random source must return a finite value in [0, 1); received ${randomValue}.`,
      );
    }

    const alphabetIndex = Math.floor(
      randomValue * ROOM_CODE_ALPHABET.length,
    );
    code += ROOM_CODE_ALPHABET[alphabetIndex]!;
  }

  return code;
}

export function createRoom(options: CreateRoomOptions): WaitingRoom {
  const mealTime = validateMealTime(options.mealTime);
  const hostPlayerId = normalizePlayerId(options.playerId);
  const host = freezePlayer({
    playerId: hostPlayerId,
    nickname: normalizeNickname(options.nickname),
    role: "host",
    rosterOrder: 0,
  });

  return Object.freeze({
    code: generateRoomCode(options.rng),
    mealTime,
    status: "waiting",
    hostPlayerId,
    players: Object.freeze([host]),
    start: null,
  });
}

/**
 * Adds a player without mutating the previous lobby state.
 *
 * A waiting player's repeated join is an idempotent reconnect and may update
 * only that player's nickname. Once started, the roster is locked and every
 * join attempt is rejected.
 */
export function joinRoom(
  room: Room,
  input: RoomPlayerInput,
): WaitingRoom {
  if (room.status === "started") {
    throw roomError(
      "ROOM_ALREADY_STARTED",
      `Room "${room.code}" has already started.`,
    );
  }

  const playerId = normalizePlayerId(input.playerId);
  const nickname = normalizeNickname(input.nickname);

  const existingPlayer = room.players.find(
    (player) => player.playerId === playerId,
  );
  if (existingPlayer) {
    if (existingPlayer.nickname === nickname) {
      return room;
    }

    const players = freezePlayers(
      room.players.map((player) =>
        player.playerId === playerId
          ? { ...player, nickname }
          : player,
      ),
    );
    return Object.freeze({
      ...room,
      players,
    });
  }

  if (room.players.length >= MAX_ROOM_PLAYERS) {
    throw roomError(
      "ROOM_FULL",
      `A room may contain at most ${MAX_ROOM_PLAYERS} players.`,
    );
  }

  const player = freezePlayer({
    playerId,
    nickname,
    role: "member",
    rosterOrder: room.players.length,
  });
  const players = freezePlayers([...room.players, player]);

  return Object.freeze({
    ...room,
    players,
  });
}

/**
 * Removes one player from a waiting lobby without mutating the previous room.
 *
 * If the host leaves, the earliest remaining roster member becomes host and
 * roster positions are compacted. `null` means the final player left and the
 * caller should delete the room. A started room is immutable, so leaving it
 * never rewrites its locked roster or start snapshot.
 */
export function leaveRoom(
  room: Room,
  playerId: string,
): WaitingRoom | null {
  if (room.status === "started") {
    throw roomError(
      "ROOM_ALREADY_STARTED",
      `Room "${room.code}" has already started.`,
    );
  }

  const normalizedPlayerId = normalizePlayerId(playerId);
  if (
    !room.players.some(
      (player) => player.playerId === normalizedPlayerId,
    )
  ) {
    throw roomError(
      "PLAYER_NOT_FOUND",
      `Player id "${normalizedPlayerId}" is not in the room.`,
    );
  }

  const remaining = room.players.filter(
    (player) => player.playerId !== normalizedPlayerId,
  );
  if (remaining.length === 0) {
    return null;
  }

  const players = freezePlayers(
    remaining.map((player, rosterOrder) => ({
      ...player,
      role: rosterOrder === 0 ? "host" : "member",
      rosterOrder,
    })),
  );
  const nextHost = players[0]!;

  return Object.freeze({
    ...room,
    hostPlayerId: nextHost.playerId,
    players,
  });
}

/**
 * Read-only lobby helper. There is intentionally no per-player ready state.
 */
export function canStartRoom(
  room: Room,
  requesterPlayerId: string,
): boolean {
  if (room.status !== "waiting") {
    return false;
  }

  let playerId: string;
  try {
    playerId = normalizePlayerId(requesterPlayerId);
  } catch {
    return false;
  }

  return (
    playerId === room.hostPlayerId &&
    room.players.length >= MIN_ROOM_PLAYERS
  );
}

/**
 * Locks the current roster and records the shared game-start contract.
 */
export function startRoom(
  room: Room,
  options: StartRoomOptions,
): StartedRoom {
  if (room.status === "started") {
    throw roomError(
      "ROOM_ALREADY_STARTED",
      `Room "${room.code}" has already started.`,
    );
  }

  const requesterPlayerId = normalizePlayerId(
    options.requesterPlayerId,
  );
  if (requesterPlayerId !== room.hostPlayerId) {
    throw roomError(
      "HOST_ONLY",
      "Only the room host may start the game.",
    );
  }

  if (room.players.length < MIN_ROOM_PLAYERS) {
    throw roomError(
      "NOT_ENOUGH_PLAYERS",
      `At least ${MIN_ROOM_PLAYERS} players are required to start.`,
    );
  }

  const deckSeed = normalizeDeckSeed(options.deckSeed);
  const contentVersion = normalizeContentVersion(
    options.contentVersion,
  );
  const startAt = validateStartAt(options.startAt);
  const roster = freezePlayers(room.players);
  const start = Object.freeze({
    deckSeed,
    contentVersion,
    startAt,
    roster,
  });

  return Object.freeze({
    ...room,
    status: "started",
    players: roster,
    start,
  });
}

function normalizePlayerId(playerId: string): string {
  if (typeof playerId !== "string") {
    throw roomError(
      "INVALID_PLAYER_ID",
      "A player id must be a string.",
    );
  }

  const normalized = playerId.normalize("NFKC").trim();
  if (normalized.length === 0) {
    throw roomError(
      "INVALID_PLAYER_ID",
      "A player id must not be empty.",
    );
  }

  return normalized;
}

function validateMealTime(mealTime: MealTime): MealTime {
  if (mealTime !== "lunch" && mealTime !== "dinner") {
    throw roomError(
      "INVALID_MEAL_TIME",
      `Meal time must be "lunch" or "dinner"; received ${String(mealTime)}.`,
    );
  }

  return mealTime;
}

function normalizeDeckSeed(deckSeed: RoomDeckSeed): RoomDeckSeed {
  if (typeof deckSeed === "number") {
    if (!Number.isFinite(deckSeed)) {
      throw roomError(
        "INVALID_DECK_SEED",
        "A numeric deck seed must be finite.",
      );
    }
    return deckSeed;
  }

  if (typeof deckSeed === "string") {
    const normalized = deckSeed.normalize("NFKC").trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  throw roomError(
    "INVALID_DECK_SEED",
    "A deck seed must be a finite number or a non-empty string.",
  );
}

function normalizeContentVersion(contentVersion: string): string {
  if (typeof contentVersion !== "string") {
    throw roomError(
      "INVALID_CONTENT_VERSION",
      "A content version must be a string.",
    );
  }

  const normalized = contentVersion.normalize("NFKC").trim();
  if (normalized.length === 0) {
    throw roomError(
      "INVALID_CONTENT_VERSION",
      "A content version must not be empty.",
    );
  }

  return normalized;
}

function validateStartAt(startAt: number): number {
  if (
    !Number.isFinite(startAt) ||
    !Number.isInteger(startAt) ||
    startAt < 0
  ) {
    throw roomError(
      "INVALID_START_AT",
      "A start timestamp must be a non-negative integer.",
    );
  }

  return startAt;
}

function freezePlayer(player: RoomPlayer): RoomPlayer {
  return Object.freeze({ ...player });
}

function freezePlayers(
  players: readonly RoomPlayer[],
): readonly RoomPlayer[] {
  return Object.freeze(players.map((player) => freezePlayer(player)));
}

function roomError(
  code: RoomDomainErrorCode,
  message: string,
): RoomDomainError {
  return new RoomDomainError(code, message);
}

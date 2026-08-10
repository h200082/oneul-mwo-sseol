export const MIN_ROOM_PLAYERS = 2;
export const MAX_ROOM_PLAYERS = 8;
export const MAX_NICKNAME_LENGTH = 16;
export const ROOM_CODE_LENGTH = 8;
export const ROOM_RESULT_WINDOW_MS = 180_000;
export const ROOM_RESULT_SYNC_GRACE_MS = 5_000;

/**
 * Uppercase letters and digits with 0, 1, I, L, and O removed so a room code
 * remains easy to read aloud and type from another player's screen.
 */
export const ROOM_CODE_ALPHABET =
  "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type MealTime = "lunch" | "dinner";
export type RoomStatus = "waiting" | "preparing" | "started";
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
  | "READY_HANDSHAKE_REQUIRED"
  | "HOST_ONLY"
  | "NOT_ENOUGH_PLAYERS"
  | "INVALID_START_ID"
  | "START_ID_MISMATCH"
  | "NOT_ALL_PLAYERS_READY"
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

export interface RoomPreparationSnapshot {
  readonly startId: string;
  /**
   * All clients use this one seed to reproduce the same menu deck.
   */
  readonly deckSeed: RoomDeckSeed;
  readonly contentVersion: string;
  /**
   * Immutable roster in the exact order used by the game and result screen.
   */
  readonly roster: readonly RoomPlayer[];
  readonly readyPlayerIds: readonly string[];
}

export interface PreparingRoom extends RoomBase {
  readonly status: "preparing";
  readonly start: Readonly<RoomPreparationSnapshot>;
}

export interface RoomStartSnapshot extends RoomPreparationSnapshot {
  readonly startAt: number;
  readonly resultDeadlineAt: number;
}

export interface StartedRoom extends RoomBase {
  readonly status: "started";
  readonly start: Readonly<RoomStartSnapshot>;
}

export type Room = WaitingRoom | PreparingRoom | StartedRoom;

export interface CreateRoomOptions extends RoomPlayerInput {
  readonly mealTime: MealTime;
  readonly rng?: RoomRandomSource;
}

export interface StartRoomOptions {
  readonly requesterPlayerId: string;
  readonly deckSeed: RoomDeckSeed;
  readonly contentVersion: string;
  readonly startAt: number;
  readonly startId?: string;
}

export interface PrepareRoomStartOptions {
  readonly requesterPlayerId: string;
  readonly startId: string;
  readonly deckSeed: RoomDeckSeed;
  readonly contentVersion: string;
}

export interface AcknowledgeRoomReadyOptions {
  readonly playerId: string;
  readonly startId: string;
}

export interface FinalizeRoomStartOptions {
  readonly requesterPlayerId: string;
  readonly startId: string;
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
  if (room.status !== "waiting") {
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
  if (room.status !== "waiting") {
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
  if (room.status !== "waiting") {
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
  const resultDeadlineAt = startAt + ROOM_RESULT_WINDOW_MS;
  if (!Number.isSafeInteger(resultDeadlineAt)) {
    throw roomError(
      "INVALID_START_AT",
      "The derived result deadline must be a safe integer timestamp.",
    );
  }
  const roster = freezePlayers(room.players);
  const startId = normalizeStartId(options.startId ?? "legacy-start");
  const start = Object.freeze({
    startId,
    deckSeed,
    contentVersion,
    startAt,
    resultDeadlineAt,
    roster,
    readyPlayerIds: freezePlayerIds(
      roster.map((player) => player.playerId),
    ),
  });

  return Object.freeze({
    ...room,
    status: "started",
    players: roster,
    start,
  });
}

/**
 * Locks the current roster and creates an idempotent preparation attempt.
 */
export function prepareRoomStart(
  room: Room,
  options: PrepareRoomStartOptions,
): PreparingRoom {
  const requesterPlayerId = normalizePlayerId(
    options.requesterPlayerId,
  );
  const startId = normalizeStartId(options.startId);
  const deckSeed = normalizeDeckSeed(options.deckSeed);
  const contentVersion = normalizeContentVersion(
    options.contentVersion,
  );

  if (requesterPlayerId !== room.hostPlayerId) {
    throw roomError(
      "HOST_ONLY",
      "Only the room host may prepare the game.",
    );
  }

  if (room.status === "preparing") {
    if (
      room.start.startId === startId &&
      room.start.deckSeed === deckSeed &&
      room.start.contentVersion === contentVersion
    ) {
      return room;
    }
    throw roomError(
      "START_ID_MISMATCH",
      "The room is already preparing a different start attempt.",
    );
  }

  if (room.status === "started") {
    throw roomError(
      "ROOM_ALREADY_STARTED",
      "The room has already started.",
    );
  }

  if (room.players.length < MIN_ROOM_PLAYERS) {
    throw roomError(
      "NOT_ENOUGH_PLAYERS",
      "At least two players are required to start.",
    );
  }

  const roster = freezePlayers(room.players);
  return Object.freeze({
    ...room,
    status: "preparing",
    players: roster,
    start: Object.freeze({
      startId,
      deckSeed,
      contentVersion,
      roster,
      readyPlayerIds: freezePlayerIds([]),
    }),
  });
}

/**
 * Acknowledges readiness for one locked-roster player. Duplicate
 * acknowledgements are idempotent and stale start identities are rejected.
 */
export function acknowledgeRoomReady(
  room: Room,
  options: AcknowledgeRoomReadyOptions,
): PreparingRoom | StartedRoom {
  if (room.status === "waiting") {
    throw roomError(
      "READY_HANDSHAKE_REQUIRED",
      "The host must prepare a start attempt before players can be ready.",
    );
  }

  const playerId = normalizePlayerId(options.playerId);
  const startId = normalizeStartId(options.startId);
  if (room.start.startId !== startId) {
    throw roomError(
      "START_ID_MISMATCH",
      "This readiness acknowledgement belongs to a stale start attempt.",
    );
  }
  if (
    !room.start.roster.some(
      (player) => player.playerId === playerId,
    )
  ) {
    throw roomError(
      "PLAYER_NOT_FOUND",
      "The player is not in the locked roster.",
    );
  }
  if (room.start.readyPlayerIds.includes(playerId)) {
    return room;
  }
  if (room.status === "started") {
    throw roomError(
      "ROOM_ALREADY_STARTED",
      "A finalized start cannot accept a new readiness acknowledgement.",
    );
  }

  const readyPlayerIds = freezePlayerIds(
    [...room.start.readyPlayerIds, playerId],
  );
  return Object.freeze({
    ...room,
    start: Object.freeze({
      ...room.start,
      readyPlayerIds,
    }),
  });
}

/**
 * Finalizes the shared clock only after every locked-roster player is ready.
 */
export function finalizeRoomStart(
  room: Room,
  options: FinalizeRoomStartOptions,
): StartedRoom {
  if (room.status === "waiting") {
    throw roomError(
      "READY_HANDSHAKE_REQUIRED",
      "The host must prepare a start attempt before finalizing it.",
    );
  }

  const requesterPlayerId = normalizePlayerId(
    options.requesterPlayerId,
  );
  const startId = normalizeStartId(options.startId);
  const startAt = validateStartAt(options.startAt);
  if (requesterPlayerId !== room.hostPlayerId) {
    throw roomError(
      "HOST_ONLY",
      "Only the room host may finalize the game start.",
    );
  }
  if (room.start.startId !== startId) {
    throw roomError(
      "START_ID_MISMATCH",
      "This finalization belongs to a stale start attempt.",
    );
  }
  if (room.status === "started") {
    if (room.start.startAt === startAt) {
      return room;
    }
    throw roomError(
      "ROOM_ALREADY_STARTED",
      "The room already has a different finalized start time.",
    );
  }

  if (
    room.start.readyPlayerIds.length !== room.start.roster.length ||
    room.start.roster.some(
      (player) =>
        !room.start.readyPlayerIds.includes(player.playerId),
    )
  ) {
    throw roomError(
      "NOT_ALL_PLAYERS_READY",
      "Every locked-roster player must be ready before start time is finalized.",
    );
  }

  const resultDeadlineAt = startAt + ROOM_RESULT_WINDOW_MS;
  if (!Number.isSafeInteger(resultDeadlineAt)) {
    throw roomError(
      "INVALID_START_AT",
      "The derived result deadline must be a safe integer timestamp.",
    );
  }

  return Object.freeze({
    ...room,
    status: "started",
    start: Object.freeze({
      ...room.start,
      startAt,
      resultDeadlineAt,
    }),
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
    !Number.isSafeInteger(startAt) ||
    startAt < 0
  ) {
    throw roomError(
      "INVALID_START_AT",
      "A start timestamp must be a non-negative integer.",
    );
  }

  return startAt;
}

function normalizeStartId(startId: string): string {
  if (typeof startId !== "string") {
    throw roomError(
      "INVALID_START_ID",
      "A start identity must be a string.",
    );
  }

  const normalized = startId.normalize("NFKC").trim();
  if (normalized.length === 0 || normalized.length > 128) {
    throw roomError(
      "INVALID_START_ID",
      "A start identity must contain between 1 and 128 characters.",
    );
  }
  return normalized;
}

function freezePlayer(player: RoomPlayer): RoomPlayer {
  return Object.freeze({ ...player });
}

function freezePlayers(
  players: readonly RoomPlayer[],
): readonly RoomPlayer[] {
  return Object.freeze(players.map((player) => freezePlayer(player)));
}

function freezePlayerIds(
  playerIds: readonly string[],
): readonly string[] {
  return Object.freeze([...playerIds]);
}

function roomError(
  code: RoomDomainErrorCode,
  message: string,
): RoomDomainError {
  return new RoomDomainError(code, message);
}

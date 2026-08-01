import { describe, expect, it } from "vitest";

import {
  MAX_NICKNAME_LENGTH,
  MAX_ROOM_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  RoomDomainError,
  canStartRoom,
  createRoom,
  generateRoomCode,
  joinRoom,
  leaveRoom,
  normalizeNickname,
  startRoom,
  type MealTime,
  type Room,
  type RoomDomainErrorCode,
  type WaitingRoom,
} from "../src/domain/room";

function makeWaitingRoom(): WaitingRoom {
  return createRoom({
    playerId: "host-id",
    nickname: "방장",
    mealTime: "lunch",
    rng: () => 0,
  });
}

function makeTwoPlayerRoom(): WaitingRoom {
  return joinRoom(makeWaitingRoom(), {
    playerId: "member-id",
    nickname: "참가자",
  });
}

function expectRoomError(
  action: () => unknown,
  code: RoomDomainErrorCode,
): void {
  let caught: unknown;

  try {
    action();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(RoomDomainError);
  expect(caught).toMatchObject({ code });
}

describe("room identity and creation", () => {
  it("normalizes full-width characters and repeated nickname whitespace", () => {
    expect(normalizeNickname("　Ａｌｉｃｅ \n  김　")).toBe(
      "Alice 김",
    );
  });

  it("creates one host in a waiting lunch or dinner room", () => {
    const room = createRoom({
      playerId: "  host-id  ",
      nickname: "  저녁 방장  ",
      mealTime: "dinner",
      rng: () => 0,
    });

    expect(room).toMatchObject({
      code: "22222222",
      mealTime: "dinner",
      status: "waiting",
      hostPlayerId: "host-id",
      start: null,
    });
    expect(room.players).toEqual([
      {
        playerId: "host-id",
        nickname: "저녁 방장",
        role: "host",
        rosterOrder: 0,
      },
    ]);
    expect(
      room.players.filter((player) => player.role === "host"),
    ).toHaveLength(1);
  });

  it("generates exactly eight deterministic readable characters", () => {
    const values = [
      0,
      0.999_999,
      0.1,
      0.2,
      0.3,
      0.4,
      0.5,
      0.6,
    ];
    let index = 0;

    const code = generateRoomCode(() => values[index++]!);

    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(
      [...code].every((character) =>
        ROOM_CODE_ALPHABET.includes(character),
      ),
    ).toBe(true);
    expect(code).not.toMatch(/[01ILO]/u);
    expect(index).toBe(ROOM_CODE_LENGTH);
  });

  it("reports explicit errors for invalid creation inputs", () => {
    expectRoomError(
      () =>
        createRoom({
          playerId: " ",
          nickname: "방장",
          mealTime: "lunch",
        }),
      "INVALID_PLAYER_ID",
    );
    expectRoomError(
      () =>
        createRoom({
          playerId: "host",
          nickname: "\n\t",
          mealTime: "lunch",
        }),
      "INVALID_NICKNAME",
    );
    expectRoomError(
      () =>
        createRoom({
          playerId: "host",
          nickname: "가".repeat(MAX_NICKNAME_LENGTH + 1),
          mealTime: "lunch",
        }),
      "INVALID_NICKNAME",
    );
    expectRoomError(
      () =>
        createRoom({
          playerId: "host",
          nickname: "방장",
          mealTime: "breakfast" as MealTime,
        }),
      "INVALID_MEAL_TIME",
    );
    expectRoomError(
      () => generateRoomCode(() => 1),
      "INVALID_RANDOM_VALUE",
    );
    expectRoomError(
      () => generateRoomCode(() => Number.NaN),
      "INVALID_RANDOM_VALUE",
    );
  });
});

describe("joining a room", () => {
  it("appends a normalized member without mutating the previous room", () => {
    const original = makeWaitingRoom();

    const joined = joinRoom(original, {
      playerId: "  member-1  ",
      nickname: "  메뉴   고민러 ",
    });

    expect(original.players).toHaveLength(1);
    expect(joined.players).toHaveLength(2);
    expect(joined.players[1]).toEqual({
      playerId: "member-1",
      nickname: "메뉴 고민러",
      role: "member",
      rosterOrder: 1,
    });
    expect(joined.hostPlayerId).toBe(original.hostPlayerId);
    expect(joined.players[0]?.role).toBe("host");
  });

  it("allows duplicate nicknames because player ids own identity", () => {
    const first = joinRoom(makeWaitingRoom(), {
      playerId: "member-1",
      nickname: "고민러",
    });
    const second = joinRoom(first, {
      playerId: "member-2",
      nickname: "  고민러 ",
    });

    expect(second.players.map((player) => player.nickname)).toEqual([
      "방장",
      "고민러",
      "고민러",
    ]);
  });

  it("treats a normalized duplicate player id as an idempotent reconnect", () => {
    const room = joinRoom(makeWaitingRoom(), {
      playerId: "ＡＢＣ",
      nickname: "첫 참가자",
    });

    const unchanged = joinRoom(room, {
      playerId: " ABC ",
      nickname: "첫 참가자",
    });
    const renamed = joinRoom(room, {
      playerId: " ABC ",
      nickname: "  돌아온 참가자 ",
    });

    expect(unchanged).toBe(room);
    expect(renamed.players).toHaveLength(room.players.length);
    expect(renamed.players[1]).toEqual({
      playerId: "ABC",
      nickname: "돌아온 참가자",
      role: "member",
      rosterOrder: 1,
    });
    expect(room.players[1]?.nickname).toBe("첫 참가자");
  });

  it("accepts eight players and rejects the ninth", () => {
    let room = makeWaitingRoom();

    for (let index = 1; index < MAX_ROOM_PLAYERS; index += 1) {
      room = joinRoom(room, {
        playerId: `member-${index}`,
        nickname: `참가자 ${index}`,
      });
    }

    expect(room.players).toHaveLength(MAX_ROOM_PLAYERS);
    expectRoomError(
      () =>
        joinRoom(room, {
          playerId: "ninth-player",
          nickname: "아홉 번째",
        }),
      "ROOM_FULL",
    );
  });
});

describe("leaving a waiting room", () => {
  it("removes a member and compacts roster order without mutation", () => {
    const firstJoin = joinRoom(makeTwoPlayerRoom(), {
      playerId: "member-2",
      nickname: "두 번째 참가자",
    });

    const left = leaveRoom(firstJoin, " member-id ");

    expect(left).not.toBeNull();
    expect(firstJoin.players).toHaveLength(3);
    expect(left?.players).toEqual([
      {
        playerId: "host-id",
        nickname: "방장",
        role: "host",
        rosterOrder: 0,
      },
      {
        playerId: "member-2",
        nickname: "두 번째 참가자",
        role: "member",
        rosterOrder: 1,
      },
    ]);
    expect(Object.isFrozen(left?.players)).toBe(true);
  });

  it("promotes the earliest remaining participant when the host leaves", () => {
    const waiting = joinRoom(makeTwoPlayerRoom(), {
      playerId: "member-2",
      nickname: "두 번째 참가자",
    });

    const left = leaveRoom(waiting, "host-id");

    expect(left).toMatchObject({
      hostPlayerId: "member-id",
      status: "waiting",
    });
    expect(left?.players).toEqual([
      {
        playerId: "member-id",
        nickname: "참가자",
        role: "host",
        rosterOrder: 0,
      },
      {
        playerId: "member-2",
        nickname: "두 번째 참가자",
        role: "member",
        rosterOrder: 1,
      },
    ]);
    expect(canStartRoom(left!, "member-id")).toBe(true);
  });

  it("returns null when the final participant leaves", () => {
    const waiting = makeWaitingRoom();

    expect(leaveRoom(waiting, "host-id")).toBeNull();
    expect(waiting.players).toHaveLength(1);
  });

  it("rejects an unknown participant", () => {
    expectRoomError(
      () => leaveRoom(makeTwoPlayerRoom(), "missing-player"),
      "PLAYER_NOT_FOUND",
    );
  });

  it("never changes a roster after the room starts", () => {
    const started = startRoom(makeTwoPlayerRoom(), {
      requesterPlayerId: "host-id",
      deckSeed: "locked-seed",
      contentVersion: "menus-v1",
      startAt: 123,
    });
    const rosterBeforeLeave = started.players;
    const startBeforeLeave = started.start;

    expectRoomError(
      () => leaveRoom(started, "member-id"),
      "ROOM_ALREADY_STARTED",
    );
    expect(started.players).toBe(rosterBeforeLeave);
    expect(started.start).toBe(startBeforeLeave);
  });
});

describe("starting a room", () => {
  it("lets the host start immediately at two players without ready state", () => {
    const room = makeTwoPlayerRoom();

    expect(
      room.players.every(
        (player) => !("ready" in player),
      ),
    ).toBe(true);
    expect(canStartRoom(room, "host-id")).toBe(true);
    expect(canStartRoom(room, "member-id")).toBe(false);
  });

  it("locks the roster and stores one shared start contract", () => {
    const waiting = makeTwoPlayerRoom();

    const started = startRoom(waiting, {
      requesterPlayerId: " host-id ",
      deckSeed: "  deck-2026  ",
      contentVersion: " menus-v1 ",
      startAt: 1_800_000_000_000,
    });

    expect(waiting.status).toBe("waiting");
    expect(started.status).toBe("started");
    expect(started.start).toMatchObject({
      deckSeed: "deck-2026",
      contentVersion: "menus-v1",
      startAt: 1_800_000_000_000,
    });
    expect(started.start.roster).toEqual(started.players);
    expect(started.start.roster.map((player) => player.playerId)).toEqual([
      "host-id",
      "member-id",
    ]);
    expect(Object.isFrozen(started.players)).toBe(true);
    expect(Object.isFrozen(started.start.roster)).toBe(true);
    expect(Object.isFrozen(started.start)).toBe(true);
  });

  it("rejects starting with only the host", () => {
    const room = makeWaitingRoom();

    expect(canStartRoom(room, "host-id")).toBe(false);
    expectRoomError(
      () =>
        startRoom(room, {
          requesterPlayerId: "host-id",
          deckSeed: 42,
          contentVersion: "menus-v1",
          startAt: 123,
        }),
      "NOT_ENOUGH_PLAYERS",
    );
  });

  it("rejects a non-host start request", () => {
    const room = makeTwoPlayerRoom();

    expectRoomError(
      () =>
        startRoom(room, {
          requesterPlayerId: "member-id",
          deckSeed: 42,
          contentVersion: "menus-v1",
          startAt: 123,
        }),
      "HOST_ONLY",
    );
  });

  it("rejects joins and repeated starts after the roster is locked", () => {
    const started = startRoom(makeTwoPlayerRoom(), {
      requesterPlayerId: "host-id",
      deckSeed: 42,
      contentVersion: "menus-v1",
      startAt: 123,
    });

    expect(canStartRoom(started, "host-id")).toBe(false);
    expectRoomError(
      () =>
        joinRoom(started, {
          playerId: "late-player",
          nickname: "지각생",
        }),
      "ROOM_ALREADY_STARTED",
    );
    expectRoomError(
      () =>
        startRoom(started, {
          requesterPlayerId: "host-id",
          deckSeed: 43,
          contentVersion: "menus-v1",
          startAt: 124,
        }),
      "ROOM_ALREADY_STARTED",
    );
  });

  it("reports explicit errors for invalid shared start metadata", () => {
    const room = makeTwoPlayerRoom();
    const start = (
      overrides: Partial<{
        deckSeed: number | string;
        contentVersion: string;
        startAt: number;
      }>,
    ) =>
      startRoom(room, {
        requesterPlayerId: "host-id",
        deckSeed: 42,
        contentVersion: "menus-v1",
        startAt: 123,
        ...overrides,
      });

    expectRoomError(
      () => start({ deckSeed: Number.NaN }),
      "INVALID_DECK_SEED",
    );
    expectRoomError(
      () => start({ deckSeed: "  " }),
      "INVALID_DECK_SEED",
    );
    expectRoomError(
      () => start({ contentVersion: "\t" }),
      "INVALID_CONTENT_VERSION",
    );
    expectRoomError(
      () => start({ startAt: 12.5 }),
      "INVALID_START_AT",
    );
    expectRoomError(
      () => start({ startAt: -1 }),
      "INVALID_START_AT",
    );
  });

  it("keeps the room union narrowed by status", () => {
    const room: Room = startRoom(makeTwoPlayerRoom(), {
      requesterPlayerId: "host-id",
      deckSeed: "shared-seed",
      contentVersion: "menus-v1",
      startAt: 123,
    });

    if (room.status === "started") {
      expect(room.start.deckSeed).toBe("shared-seed");
    }
  });
});

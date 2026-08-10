import type { MealTime, RoomDeckSeed } from '../domain/room'
import type { GameLaunchOptions } from './gameTypes'

const PERSONAL_BEST_STORAGE_KEY = 'oneul-mwo-sseol-personal-bests-v1'

export interface PersonalBestIdentity {
  readonly mode: GameLaunchOptions['mode']
  readonly mealTime: MealTime
  readonly contentVersion: string
}

export interface PersonalBestRecord extends PersonalBestIdentity {
  readonly score: number
  readonly achievedAt: number
  readonly deckSeed: RoomDeckSeed
}

export interface PersonalBestUpdate {
  readonly record: Readonly<PersonalBestRecord>
  readonly previousScore: number | null
  readonly isNewBest: boolean
}

type StoredRecords = Record<string, PersonalBestRecord>

export class PersonalBestStore {
  constructor(
    private readonly storage: Storage,
    private readonly storageKey = PERSONAL_BEST_STORAGE_KEY,
  ) {}

  read(identity: Readonly<PersonalBestIdentity>): PersonalBestRecord | null {
    const record = this.readAll()[createIdentityKey(identity)]
    return record ? freezeRecord(record) : null
  }

  record(
    identity: Readonly<PersonalBestIdentity>,
    score: number,
    achievedAt: number,
    deckSeed: RoomDeckSeed,
  ): Readonly<PersonalBestUpdate> {
    assertScore(score)
    assertTimestamp(achievedAt)

    const records = this.readAll()
    const key = createIdentityKey(identity)
    const previous = records[key]
    if (previous && previous.score >= score) {
      return Object.freeze({
        record: freezeRecord(previous),
        previousScore: previous.score,
        isNewBest: false,
      })
    }

    const next = freezeRecord({
      ...identity,
      score,
      achievedAt,
      deckSeed,
    })
    records[key] = next
    this.writeAll(records)

    return Object.freeze({
      record: next,
      previousScore: previous?.score ?? null,
      isNewBest: true,
    })
  }

  private readAll(): StoredRecords {
    try {
      const raw = this.storage.getItem(this.storageKey)
      if (!raw) {
        return {}
      }
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
      }

      return Object.fromEntries(
        Object.entries(parsed).flatMap(([key, value]) =>
          isPersonalBestRecord(value) ? [[key, value]] : [],
        ),
      )
    } catch {
      return {}
    }
  }

  private writeAll(records: StoredRecords): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(records))
    } catch {
      // Privacy-restricted browsers can play without persistent best scores.
    }
  }
}

function createIdentityKey(identity: Readonly<PersonalBestIdentity>): string {
  return [identity.mode, identity.mealTime, identity.contentVersion].join(':')
}

function freezeRecord(record: PersonalBestRecord): PersonalBestRecord {
  return Object.freeze({ ...record })
}

function isPersonalBestRecord(value: unknown): value is PersonalBestRecord {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<PersonalBestRecord>
  return (
    (candidate.mode === 'solo' || candidate.mode === 'room') &&
    (candidate.mealTime === 'lunch' || candidate.mealTime === 'dinner') &&
    typeof candidate.contentVersion === 'string' &&
    candidate.contentVersion.length > 0 &&
    typeof candidate.score === 'number' &&
    Number.isFinite(candidate.score) &&
    candidate.score >= 0 &&
    candidate.score <= 100 &&
    typeof candidate.achievedAt === 'number' &&
    Number.isFinite(candidate.achievedAt) &&
    candidate.achievedAt >= 0 &&
    (typeof candidate.deckSeed === 'string' ||
      typeof candidate.deckSeed === 'number')
  )
}

function assertScore(score: number): void {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError('Personal best score must be between 0 and 100.')
  }
}

function assertTimestamp(achievedAt: number): void {
  if (!Number.isFinite(achievedAt) || achievedAt < 0) {
    throw new RangeError('Personal best timestamp must be non-negative.')
  }
}

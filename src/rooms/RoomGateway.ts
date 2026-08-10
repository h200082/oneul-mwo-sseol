import type {
  AcknowledgeRoomReadyOptions,
  CreateRoomOptions,
  FinalizeRoomStartOptions,
  PrepareRoomStartOptions,
  PreparingRoom,
  Room,
  RoomPlayerInput,
  StartedRoom,
  StartRoomOptions,
  WaitingRoom,
} from '../domain/room'
import type { RoomResultSubmission } from '../domain/roomResults'

export type RoomListener = (room: Room | null) => void
export type RoomErrorListener = (error: unknown) => void
export interface RoomSnapshotMetadata {
  readonly fromCache: boolean
  readonly hasPendingWrites: boolean
}
export type RoomMetadataListener = (
  metadata: Readonly<RoomSnapshotMetadata>,
) => void
export type RoomUnsubscribe = () => void
export type RoomResultsListener = (
  results: readonly RoomResultSubmission[],
) => void
export type RoomResultsErrorListener = (error: unknown) => void

export interface AuthoritativeRoomResultState {
  readonly finalization: 'open' | 'closed'
  readonly results: readonly RoomResultSubmission[]
}

/**
 * A small invalidation channel. The room itself always comes from Storage so
 * notifications cannot become a second, conflicting source of truth.
 */
export interface RoomNotificationChannel {
  publish(roomCode: string): void
  subscribe(listener: (roomCode: string) => void): RoomUnsubscribe
}

export interface RoomGateway {
  create(options: CreateRoomOptions): Promise<WaitingRoom>
  join(
    roomCode: string,
    player: RoomPlayerInput,
  ): Promise<WaitingRoom>
  get(roomCode: string): Promise<Room | null>
  leave(
    roomCode: string,
    playerId: string,
  ): Promise<WaitingRoom | null>
  subscribe(
    roomCode: string,
    listener: RoomListener,
    onError?: RoomErrorListener,
    onMetadata?: RoomMetadataListener,
  ): Promise<RoomUnsubscribe>
  prepareStart(
    roomCode: string,
    options: PrepareRoomStartOptions,
  ): Promise<PreparingRoom>
  acknowledgeReady(
    roomCode: string,
    options: AcknowledgeRoomReadyOptions,
  ): Promise<PreparingRoom | StartedRoom>
  finalizeStart(
    roomCode: string,
    options: FinalizeRoomStartOptions,
  ): Promise<StartedRoom>
  /**
   * @deprecated Use prepareStart, acknowledgeReady, then finalizeStart.
   * Implementations reject waiting-to-started direct transitions.
   */
  start(
    roomCode: string,
    options: StartRoomOptions,
  ): Promise<StartedRoom>
  submitResult(
    roomCode: string,
    submission: RoomResultSubmission,
  ): Promise<readonly RoomResultSubmission[]>
  readAuthoritativeResultState(
    roomCode: string,
  ): Promise<Readonly<AuthoritativeRoomResultState>>
  subscribeResults(
    roomCode: string,
    listener: RoomResultsListener,
    onError?: RoomResultsErrorListener,
  ): Promise<RoomUnsubscribe>
  dispose?(): void
}

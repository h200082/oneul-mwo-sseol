export interface KalguksuCopyRetake01ApprovedAudioSelection {
  readonly menuId: 'kalguksu'
  readonly catalogText: '칼은 위협용!'
  readonly spokenText: '칼은 위협용!'
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly byteLength: 28320
  readonly sha256: string
  readonly mpegFrameCount: 59
  readonly exactDurationSeconds: 1.416
  readonly sourceManifest: {
    readonly path: string
    readonly byteLength: 2956
    readonly sha256: string
    readonly schemaVersion: 2
    readonly generatedAt: string
  }
  readonly rejectedPredecessor: {
    readonly path: string
    readonly byteLength: 77760
    readonly sha256: string
    readonly mpegFrameCount: 162
    readonly exactDurationSeconds: 3.888
    readonly catalogText: string
    readonly deploymentStatus: 'rejected-source-not-integrated'
  }
  readonly tone: 'deadpan'
  readonly modelId: 'flash'
  readonly model: 'MAI-Voice-2-Flash'
  readonly voiceId: 'junho'
  readonly voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash'
  readonly style: 'determined'
  readonly styleDegree: 0.36
  readonly rate: '+12%'
  readonly pitch: '-1%'
  readonly structure: 'one-block'
  readonly segments: readonly ['칼은 위협용!']
  readonly approvalEvidence: {
    readonly userStatement: string
    readonly reviewedAt: '2026-08-10'
  }
  readonly humanApproved: true
  readonly approvalState: 'human-listening-approved'
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly byteCopyVerified: true
  readonly postprocessingApplied: false
  readonly additionalAzureRequests: 0
}

export const KALGUKSU_COPY_RETAKE_01_APPROVAL_QUOTE: string
export const KALGUKSU_COPY_RETAKE_01_APPROVED_AUDIO_SELECTION: KalguksuCopyRetake01ApprovedAudioSelection

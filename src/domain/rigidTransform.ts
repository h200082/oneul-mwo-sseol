import type { Point } from './geometry'

/**
 * A two-dimensional rigid transform applied in this order:
 *
 * 1. rotate a local point around `pivot` by `angleRadians`;
 * 2. translate the rotated point by `translation`.
 *
 * A Phaser container uses `pivot: { x: 0, y: 0 }`, its world position as
 * `translation`, and its current rotation as `angleRadians`.
 */
export interface RigidTransform2D {
  readonly pivot: Point
  readonly translation: Point
  readonly angleRadians: number
}

/** Maps an unrotated local point into its transformed/world coordinates. */
export function transformLocalPointToWorld(
  point: Point,
  transform: Readonly<RigidTransform2D>,
): Point {
  assertFinitePoint(point, 'point')
  assertRigidTransform(transform)

  const relativeX = point.x - transform.pivot.x
  const relativeY = point.y - transform.pivot.y
  const cosine = Math.cos(transform.angleRadians)
  const sine = Math.sin(transform.angleRadians)

  return {
    x:
      transform.translation.x +
      transform.pivot.x +
      relativeX * cosine -
      relativeY * sine,
    y:
      transform.translation.y +
      transform.pivot.y +
      relativeX * sine +
      relativeY * cosine,
  }
}

/**
 * Maps a transformed/world point back into the unrotated local coordinates.
 * This is the inverse of `transformLocalPointToWorld` for the same transform.
 */
export function transformWorldPointToLocal(
  point: Point,
  transform: Readonly<RigidTransform2D>,
): Point {
  assertFinitePoint(point, 'point')
  assertRigidTransform(transform)

  const relativeX =
    point.x - transform.translation.x - transform.pivot.x
  const relativeY =
    point.y - transform.translation.y - transform.pivot.y
  const cosine = Math.cos(transform.angleRadians)
  const sine = Math.sin(transform.angleRadians)

  return {
    x:
      transform.pivot.x +
      relativeX * cosine +
      relativeY * sine,
    y:
      transform.pivot.y -
      relativeX * sine +
      relativeY * cosine,
  }
}

/** Maps a path to world coordinates without mutating or reordering it. */
export function transformLocalPathToWorld(
  path: readonly Point[],
  transform: Readonly<RigidTransform2D>,
): Point[] {
  assertRigidTransform(transform)
  return path.map((point) => transformLocalPointToWorld(point, transform))
}

/** Maps a path to unrotated local coordinates without mutating or reordering it. */
export function transformWorldPathToLocal(
  path: readonly Point[],
  transform: Readonly<RigidTransform2D>,
): Point[] {
  assertRigidTransform(transform)
  return path.map((point) => transformWorldPointToLocal(point, transform))
}

function assertRigidTransform(transform: Readonly<RigidTransform2D>): void {
  assertFinitePoint(transform.pivot, 'transform.pivot')
  assertFinitePoint(transform.translation, 'transform.translation')
  if (!Number.isFinite(transform.angleRadians)) {
    throw new TypeError('transform.angleRadians must be finite.')
  }
}

function assertFinitePoint(point: Point, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${name} must contain finite x and y coordinates.`)
  }
}

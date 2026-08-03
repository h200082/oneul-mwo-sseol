export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Circle {
  readonly center: Point;
  readonly radius: number;
}

export interface CircleSliceResult {
  /**
   * True only when the finite gesture segment covers two distinct
   * intersections with the circle. A tangent or a segment ending inside the
   * token is not a successful slice.
   */
  readonly crossesCircle: boolean;
  /** Fraction of the full circle occupied by the smaller piece: 0..0.5. */
  readonly smallerAreaRatio: number;
  /** Fraction of the full circle occupied by the larger piece: 0.5..1. */
  readonly largerAreaRatio: number;
  /** Unrounded score in the range 0..100. */
  readonly accuracyScore: number;
}

export interface CircleCrossingChord {
  /** First circumference point reached while entering the token. */
  readonly entryPoint: Point;
  /** First circumference point reached while leaving the token. */
  readonly exitPoint: Point;
}

export const DEFAULT_PATH_CLOSURE_TOLERANCE = 24;

const GEOMETRY_EPSILON = 1e-9;

function assertFinitePoint(point: Point, name: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(`${name} must contain finite x and y coordinates.`);
  }
}

function assertCircle(circle: Circle): void {
  assertFinitePoint(circle.center, "circle.center");

  if (!Number.isFinite(circle.radius) || circle.radius <= 0) {
    throw new RangeError("circle.radius must be a positive finite number.");
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number.`);
  }
}

function squaredDistance(first: Point, second: Point): number {
  const deltaX = first.x - second.x;
  const deltaY = first.y - second.y;

  return deltaX * deltaX + deltaY * deltaY;
}

function isPointStrictlyInsideCircle(
  point: Point,
  circle: Circle,
): boolean {
  return (
    squaredDistance(point, circle.center) <
    circle.radius * circle.radius - GEOMETRY_EPSILON
  );
}

function interpolatePoint(
  start: Point,
  end: Point,
  parameter: number,
): Point {
  return {
    x: start.x + (end.x - start.x) * parameter,
    y: start.y + (end.y - start.y) * parameter,
  };
}

function findSegmentInteriorInterval(
  segmentStart: Point,
  segmentEnd: Point,
  circle: Circle,
): { start: number; end: number } | null {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength <= GEOMETRY_EPSILON ** 2) {
    return null;
  }

  const startX = segmentStart.x - circle.center.x;
  const startY = segmentStart.y - circle.center.y;
  const linearCoefficient =
    2 * (startX * segmentX + startY * segmentY);
  const constantCoefficient =
    startX * startX +
    startY * startY -
    circle.radius * circle.radius;
  const discriminant =
    linearCoefficient * linearCoefficient -
    4 * squaredLength * constantCoefficient;

  // A tangent only touches the circumference and never enters the token.
  if (discriminant <= GEOMETRY_EPSILON) {
    return null;
  }

  const squareRoot = Math.sqrt(discriminant);
  const firstRoot =
    (-linearCoefficient - squareRoot) / (2 * squaredLength);
  const secondRoot =
    (-linearCoefficient + squareRoot) / (2 * squaredLength);
  const intervalStart = Math.max(0, firstRoot);
  const intervalEnd = Math.min(1, secondRoot);

  if (intervalEnd - intervalStart <= GEOMETRY_EPSILON) {
    return null;
  }

  const midpoint = interpolatePoint(
    segmentStart,
    segmentEnd,
    (intervalStart + intervalEnd) / 2,
  );

  return isPointStrictlyInsideCircle(midpoint, circle)
    ? { start: intervalStart, end: intervalEnd }
    : null;
}

/**
 * Returns the first circumference-to-circumference chord that the sampled
 * trajectory actually travels through.
 *
 * Merely surrounding the token without entering it returns null. A path may
 * cross and later return to its original side; the first completed crossing
 * is retained. The overall path must start and finish outside or exactly on
 * the circumference, so gestures beginning or ending inside return null.
 */
export function findFirstCircleCrossingChord(
  path: readonly Point[],
  circle: Circle,
): CircleCrossingChord | null {
  assertCircle(circle);
  path.forEach((point, index) => assertFinitePoint(point, `path[${index}]`));

  if (path.length < 2) {
    return null;
  }

  const pathStart = path[0]!;
  const pathEnd = path[path.length - 1]!;

  if (
    isPointStrictlyInsideCircle(pathStart, circle) ||
    isPointStrictlyInsideCircle(pathEnd, circle)
  ) {
    return null;
  }

  let entryPoint: Point | null = null;

  for (let index = 1; index < path.length; index += 1) {
    const segmentStart = path[index - 1]!;
    const segmentEnd = path[index]!;
    const interval = findSegmentInteriorInterval(
      segmentStart,
      segmentEnd,
      circle,
    );

    if (!interval) {
      continue;
    }

    entryPoint ??= interpolatePoint(
      segmentStart,
      segmentEnd,
      interval.start,
    );

    if (!isPointStrictlyInsideCircle(segmentEnd, circle)) {
      return {
        entryPoint,
        exitPoint: interpolatePoint(
          segmentStart,
          segmentEnd,
          interval.end,
        ),
      };
    }
  }

  return null;
}

/**
 * A sampled path is considered closed when it has at least three points and
 * its first and last samples are no farther apart than `closureTolerance`.
 */
export function isPathClosed(
  path: readonly Point[],
  closureTolerance = DEFAULT_PATH_CLOSURE_TOLERANCE,
): boolean {
  assertNonNegativeFinite(closureTolerance, "closureTolerance");

  if (path.length < 3) {
    return false;
  }

  path.forEach((point, index) => assertFinitePoint(point, `path[${index}]`));

  return (
    squaredDistance(path[0]!, path[path.length - 1]!) <=
    closureTolerance * closureTolerance
  );
}

/**
 * Calculates absolute polygon area with the shoelace formula.
 * Open paths and paths with fewer than three samples have area zero.
 */
export function calculateAbsoluteClosedPathArea(
  path: readonly Point[],
  closureTolerance = DEFAULT_PATH_CLOSURE_TOLERANCE,
): number {
  if (!isPathClosed(path, closureTolerance)) {
    return 0;
  }

  let twiceSignedArea = 0;

  for (let index = 0; index < path.length; index += 1) {
    const current = path[index]!;
    const next = path[(index + 1) % path.length]!;
    twiceSignedArea += current.x * next.y - current.y * next.x;
  }

  return Math.abs(twiceSignedArea) / 2;
}

function crossProduct(first: Point, second: Point, third: Point): number {
  return (
    (second.x - first.x) * (third.y - first.y) -
    (second.y - first.y) * (third.x - first.x)
  );
}

function isPointOnSegment(
  point: Point,
  segmentStart: Point,
  segmentEnd: Point,
): boolean {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const pointX = point.x - segmentStart.x;
  const pointY = point.y - segmentStart.y;
  const segmentLength = Math.hypot(segmentX, segmentY);

  if (segmentLength <= GEOMETRY_EPSILON) {
    return squaredDistance(point, segmentStart) <= GEOMETRY_EPSILON ** 2;
  }

  const crossProduct = segmentX * pointY - segmentY * pointX;

  if (
    Math.abs(crossProduct) >
    GEOMETRY_EPSILON * Math.max(1, segmentLength)
  ) {
    return false;
  }

  const dotProduct = pointX * segmentX + pointY * segmentY;
  const squaredSegmentLength =
    segmentX * segmentX + segmentY * segmentY;

  return (
    dotProduct >= -GEOMETRY_EPSILON &&
    dotProduct <= squaredSegmentLength + GEOMETRY_EPSILON
  );
}

function orientationSign(
  first: Point,
  second: Point,
  third: Point,
): -1 | 0 | 1 {
  const cross = crossProduct(first, second, third);
  const scale = Math.max(
    1,
    Math.hypot(second.x - first.x, second.y - first.y) *
      Math.hypot(third.x - first.x, third.y - first.y),
  );

  if (Math.abs(cross) <= GEOMETRY_EPSILON * scale) {
    return 0;
  }

  return cross < 0 ? -1 : 1;
}

function doSegmentsIntersect(
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
): boolean {
  const firstStartSide = orientationSign(
    firstStart,
    firstEnd,
    secondStart,
  );
  const firstEndSide = orientationSign(
    firstStart,
    firstEnd,
    secondEnd,
  );
  const secondStartSide = orientationSign(
    secondStart,
    secondEnd,
    firstStart,
  );
  const secondEndSide = orientationSign(
    secondStart,
    secondEnd,
    firstEnd,
  );

  if (
    firstStartSide === 0 &&
    isPointOnSegment(secondStart, firstStart, firstEnd)
  ) {
    return true;
  }
  if (
    firstEndSide === 0 &&
    isPointOnSegment(secondEnd, firstStart, firstEnd)
  ) {
    return true;
  }
  if (
    secondStartSide === 0 &&
    isPointOnSegment(firstStart, secondStart, secondEnd)
  ) {
    return true;
  }
  if (
    secondEndSide === 0 &&
    isPointOnSegment(firstEnd, secondStart, secondEnd)
  ) {
    return true;
  }

  return (
    firstStartSide * firstEndSide === -1 &&
    secondStartSide * secondEndSide === -1
  );
}

function doAdjacentEdgesOverlap(
  sharedPoint: Point,
  firstOtherPoint: Point,
  secondOtherPoint: Point,
): boolean {
  if (
    orientationSign(sharedPoint, firstOtherPoint, secondOtherPoint) !== 0
  ) {
    return false;
  }

  const firstX = firstOtherPoint.x - sharedPoint.x;
  const firstY = firstOtherPoint.y - sharedPoint.y;
  const secondX = secondOtherPoint.x - sharedPoint.x;
  const secondY = secondOtherPoint.y - sharedPoint.y;

  return firstX * secondX + firstY * secondY > GEOMETRY_EPSILON;
}

/**
 * Returns true only for a non-degenerate closed polygon whose edges do not
 * cross or overlap. Adjacent edges may meet only at their shared endpoint.
 */
export function isSimpleClosedPath(
  path: readonly Point[],
  closureTolerance = DEFAULT_PATH_CLOSURE_TOLERANCE,
): boolean {
  if (!isPathClosed(path, closureTolerance)) {
    return false;
  }

  const vertices = [...path];
  if (
    vertices.length > 1 &&
    squaredDistance(vertices[0]!, vertices[vertices.length - 1]!) <=
      GEOMETRY_EPSILON ** 2
  ) {
    vertices.pop();
  }

  if (
    vertices.length < 3 ||
    calculateAbsoluteClosedPathArea(path, closureTolerance) <=
      GEOMETRY_EPSILON
  ) {
    return false;
  }

  for (let index = 0; index < vertices.length; index += 1) {
    const edgeStart = vertices[index]!;
    const edgeEnd = vertices[(index + 1) % vertices.length]!;
    if (
      squaredDistance(edgeStart, edgeEnd) <= GEOMETRY_EPSILON ** 2
    ) {
      return false;
    }
  }

  for (let firstIndex = 0; firstIndex < vertices.length; firstIndex += 1) {
    const firstStart = vertices[firstIndex]!;
    const firstEnd = vertices[(firstIndex + 1) % vertices.length]!;

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < vertices.length;
      secondIndex += 1
    ) {
      const secondStart = vertices[secondIndex]!;
      const secondEnd = vertices[(secondIndex + 1) % vertices.length]!;
      const areSequential = secondIndex === firstIndex + 1;
      const wrapAround =
        firstIndex === 0 && secondIndex === vertices.length - 1;

      if (areSequential) {
        if (
          doAdjacentEdgesOverlap(
            firstEnd,
            firstStart,
            secondEnd,
          )
        ) {
          return false;
        }
        continue;
      }

      if (wrapAround) {
        if (
          doAdjacentEdgesOverlap(
            firstStart,
            firstEnd,
            secondStart,
          )
        ) {
          return false;
        }
        continue;
      }

      if (
        doSegmentsIntersect(
          firstStart,
          firstEnd,
          secondStart,
          secondEnd,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Tests a point against a closed sampled path using an even-odd polygon test.
 * Points on the path boundary count as contained, which makes capture gestures
 * forgiving at the exact token-center boundary.
 *
 * An open path always returns false.
 */
export function doesClosedPathContainPoint(
  path: readonly Point[],
  point: Point,
  closureTolerance = DEFAULT_PATH_CLOSURE_TOLERANCE,
): boolean {
  assertFinitePoint(point, "point");

  if (!isPathClosed(path, closureTolerance)) {
    return false;
  }

  let isInside = false;

  for (
    let currentIndex = 0, previousIndex = path.length - 1;
    currentIndex < path.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = path[currentIndex]!;
    const previous = path[previousIndex]!;

    if (isPointOnSegment(point, previous, current)) {
      return true;
    }

    const crossesHorizontalRay =
      current.y > point.y !== previous.y > point.y;

    if (!crossesHorizontalRay) {
      continue;
    }

    const intersectionX =
      ((previous.x - current.x) * (point.y - current.y)) /
        (previous.y - current.y) +
      current.x;

    if (intersectionX > point.x) {
      isInside = !isInside;
    }
  }

  return isInside;
}

/** Returns whether a valid closed capture path contains the token center. */
export function doesPathContainCircleCenter(
  path: readonly Point[],
  circle: Circle,
  closureTolerance = DEFAULT_PATH_CLOSURE_TOLERANCE,
): boolean {
  assertCircle(circle);

  return doesClosedPathContainPoint(
    path,
    circle.center,
    closureTolerance,
  );
}

function squaredDistanceFromPointToSegment(
  point: Point,
  segmentStart: Point,
  segmentEnd: Point,
): number {
  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength <= GEOMETRY_EPSILON ** 2) {
    return squaredDistance(point, segmentStart);
  }

  const projection = Math.min(
    1,
    Math.max(
      0,
      ((point.x - segmentStart.x) * segmentX +
        (point.y - segmentStart.y) * segmentY) /
        squaredLength,
    ),
  );
  const closestPoint = interpolatePoint(
    segmentStart,
    segmentEnd,
    projection,
  );

  return squaredDistance(point, closestPoint);
}

/**
 * Returns whether a valid closed path surrounds the complete judgement
 * circle, rather than merely containing its center.
 *
 * The caller can separately require a simple path. For a simple polygon, a
 * contained center plus at least one radius of clearance from every boundary
 * segment means the full circle is contained. Touching the boundary counts as
 * contained to keep capture forgiving at the exact edge.
 */
export function doesClosedPathContainCircle(
  path: readonly Point[],
  circle: Circle,
  closureTolerance = DEFAULT_PATH_CLOSURE_TOLERANCE,
): boolean {
  assertCircle(circle);

  if (
    !doesClosedPathContainPoint(
      path,
      circle.center,
      closureTolerance,
    )
  ) {
    return false;
  }

  const squaredRadius = circle.radius * circle.radius;

  for (let index = 0; index < path.length; index += 1) {
    const segmentStart = path[index]!;
    const segmentEnd = path[(index + 1) % path.length]!;

    if (
      squaredDistanceFromPointToSegment(
        circle.center,
        segmentStart,
        segmentEnd,
      ) <
      squaredRadius - GEOMETRY_EPSILON
    ) {
      return false;
    }
  }

  return true;
}

function getSegmentLineValues(
  segmentStart: Point,
  segmentEnd: Point,
  circle: Circle,
): {
  segmentX: number;
  segmentY: number;
  squaredLength: number;
  projection: number;
  perpendicularDistance: number;
} {
  assertFinitePoint(segmentStart, "segmentStart");
  assertFinitePoint(segmentEnd, "segmentEnd");
  assertCircle(circle);

  const segmentX = segmentEnd.x - segmentStart.x;
  const segmentY = segmentEnd.y - segmentStart.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength <= GEOMETRY_EPSILON ** 2) {
    throw new RangeError("A slice line requires two distinct points.");
  }

  const centerX = circle.center.x - segmentStart.x;
  const centerY = circle.center.y - segmentStart.y;
  const projection =
    (centerX * segmentX + centerY * segmentY) / squaredLength;
  const perpendicularDistance =
    Math.abs(segmentX * centerY - segmentY * centerX) /
    Math.sqrt(squaredLength);

  return {
    segmentX,
    segmentY,
    squaredLength,
    projection,
    perpendicularDistance,
  };
}

/**
 * Returns true when a finite slice segment enters one side of a circle and
 * exits the other. Touching tangentially and stopping inside the circle do not
 * count as a slice.
 */
export function doesSegmentCrossCircle(
  segmentStart: Point,
  segmentEnd: Point,
  circle: Circle,
): boolean {
  const { squaredLength, projection, perpendicularDistance } =
    getSegmentLineValues(segmentStart, segmentEnd, circle);

  if (perpendicularDistance >= circle.radius - GEOMETRY_EPSILON) {
    return false;
  }

  const halfChordParameter =
    Math.sqrt(
      Math.max(
        0,
        circle.radius * circle.radius -
          perpendicularDistance * perpendicularDistance,
      ) / squaredLength,
    );
  const firstIntersection = projection - halfChordParameter;
  const secondIntersection = projection + halfChordParameter;

  return (
    firstIntersection >= -GEOMETRY_EPSILON &&
    secondIntersection <= 1 + GEOMETRY_EPSILON
  );
}

/**
 * Calculates the smaller circular-segment area made by the infinite line
 * through the two supplied points. The returned value is a fraction of the
 * full circle in the range 0..0.5.
 */
export function calculateSmallerCircleAreaRatio(
  lineStart: Point,
  lineEnd: Point,
  circle: Circle,
): number {
  const { perpendicularDistance } = getSegmentLineValues(
    lineStart,
    lineEnd,
    circle,
  );

  if (perpendicularDistance >= circle.radius) {
    return 0;
  }

  const normalizedDistance = Math.min(
    1,
    Math.max(0, perpendicularDistance / circle.radius),
  );
  const segmentAreaWithoutRadius =
    Math.acos(normalizedDistance) -
    normalizedDistance *
      Math.sqrt(Math.max(0, 1 - normalizedDistance ** 2));

  return Math.min(0.5, Math.max(0, segmentAreaWithoutRadius / Math.PI));
}

/**
 * Converts the smaller-piece fraction into the design score:
 * 50:50 -> 100, 60:40 -> 80, 75:25 -> 50.
 *
 * The result remains unrounded so ranking can use full precision.
 */
export function calculateSliceAccuracyScore(
  smallerAreaRatio: number,
): number {
  if (
    !Number.isFinite(smallerAreaRatio) ||
    smallerAreaRatio < 0 ||
    smallerAreaRatio > 0.5
  ) {
    throw new RangeError(
      "smallerAreaRatio must be a finite number between 0 and 0.5.",
    );
  }

  return smallerAreaRatio * 200;
}

/**
 * Computes all gameplay metrics for one finite slice gesture. Invalid misses,
 * tangents, and segments that do not cover the full chord score zero.
 */
export function calculateCircleSliceResult(
  segmentStart: Point,
  segmentEnd: Point,
  circle: Circle,
): CircleSliceResult {
  const crossesCircle = doesSegmentCrossCircle(
    segmentStart,
    segmentEnd,
    circle,
  );

  if (!crossesCircle) {
    return {
      crossesCircle: false,
      smallerAreaRatio: 0,
      largerAreaRatio: 1,
      accuracyScore: 0,
    };
  }

  const smallerAreaRatio = calculateSmallerCircleAreaRatio(
    segmentStart,
    segmentEnd,
    circle,
  );

  return {
    crossesCircle: true,
    smallerAreaRatio,
    largerAreaRatio: 1 - smallerAreaRatio,
    accuracyScore: calculateSliceAccuracyScore(smallerAreaRatio),
  };
}

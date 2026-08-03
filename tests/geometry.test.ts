import { describe, expect, it } from "vitest";

import {
  calculateAbsoluteClosedPathArea,
  calculateCircleSliceResult,
  calculateSliceAccuracyScore,
  calculateSmallerCircleAreaRatio,
  DEFAULT_PATH_CLOSURE_TOLERANCE,
  doesClosedPathContainPoint,
  doesClosedPathContainCircle,
  doesPathContainCircleCenter,
  doesSegmentCrossCircle,
  findFirstCircleCrossingChord,
  isPathClosed,
  isSimpleClosedPath,
  type Circle,
  type Point,
} from "../src/domain/geometry";

const TOKEN: Circle = {
  center: { x: 0, y: 0 },
  radius: 50,
};

describe("isPathClosed", () => {
  it("classifies a path whose endpoints meet as closed", () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: 0, y: 0 },
    ];

    expect(isPathClosed(path)).toBe(true);
  });

  it("includes the closure tolerance boundary", () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: DEFAULT_PATH_CLOSURE_TOLERANCE, y: 0 },
    ];

    expect(isPathClosed(path)).toBe(true);
  });

  it("classifies endpoints just outside the tolerance as open", () => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
      { x: DEFAULT_PATH_CLOSURE_TOLERANCE + 0.001, y: 0 },
    ];

    expect(isPathClosed(path)).toBe(false);
  });

  it("does not classify fewer than three samples as a closed path", () => {
    expect(
      isPathClosed([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toBe(false);
  });

  it("rejects a negative closure tolerance", () => {
    expect(() =>
      isPathClosed(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 0 },
        ],
        -1,
      ),
    ).toThrow(RangeError);
  });
});

describe("closed-path containment", () => {
  const surroundingPath: Point[] = [
    { x: -60, y: -60 },
    { x: 60, y: -60 },
    { x: 60, y: 60 },
    { x: -60, y: 60 },
    { x: -60, y: -60 },
  ];

  it("finds a token center inside a closed path", () => {
    expect(doesPathContainCircleCenter(surroundingPath, TOKEN)).toBe(true);
  });

  it("counts a point exactly on the path boundary as contained", () => {
    expect(
      doesClosedPathContainPoint(surroundingPath, { x: 60, y: 0 }),
    ).toBe(true);
  });

  it("rejects a token center outside the path", () => {
    const shiftedToken: Circle = {
      center: { x: 100, y: 0 },
      radius: 50,
    };

    expect(
      doesPathContainCircleCenter(surroundingPath, shiftedToken),
    ).toBe(false);
  });

  it("rejects containment when the gesture path remains open", () => {
    const openPath = surroundingPath.slice(0, -1);

    expect(
      doesPathContainCircleCenter(openPath, TOKEN, 10),
    ).toBe(false);
  });

  it("requires a capture path to surround the complete circle", () => {
    expect(
      doesClosedPathContainCircle(surroundingPath, TOKEN),
    ).toBe(true);

    const centerOnlyPath: Point[] = [
      { x: -60, y: -10 },
      { x: 60, y: -10 },
      { x: 60, y: 10 },
      { x: -60, y: 10 },
      { x: -60, y: -10 },
    ];

    expect(
      doesClosedPathContainCircle(centerOnlyPath, TOKEN),
    ).toBe(false);
  });

  it("allows the capture boundary to touch the judgement circle", () => {
    const tangentSquare: Point[] = [
      { x: -50, y: -50 },
      { x: 50, y: -50 },
      { x: 50, y: 50 },
      { x: -50, y: 50 },
      { x: -50, y: -50 },
    ];

    expect(
      doesClosedPathContainCircle(tangentSquare, TOKEN, 0),
    ).toBe(true);
  });
});

describe("findFirstCircleCrossingChord", () => {
  it("returns the first entry and exit points of a sampled crossing", () => {
    const chord = findFirstCircleCrossingChord(
      [
        { x: -80, y: -20 },
        { x: 0, y: -20 },
        { x: 80, y: -20 },
        { x: 80, y: 20 },
        { x: 0, y: 20 },
        { x: -80, y: 20 },
      ],
      TOKEN,
    );
    const halfChord = Math.sqrt(50 ** 2 - 20 ** 2);

    expect(chord).not.toBeNull();
    expect(chord?.entryPoint.x).toBeCloseTo(-halfChord, 12);
    expect(chord?.entryPoint.y).toBeCloseTo(-20, 12);
    expect(chord?.exitPoint.x).toBeCloseTo(halfChord, 12);
    expect(chord?.exitPoint.y).toBeCloseTo(-20, 12);
  });

  it("rejects a sampled semicircle that stays outside the token", () => {
    const outsideArc = Array.from({ length: 17 }, (_, index) => {
      const angle = Math.PI - (Math.PI * index) / 16;
      return {
        x: Math.cos(angle) * 80,
        y: Math.sin(angle) * 80,
      };
    });

    expect(findFirstCircleCrossingChord(outsideArc, TOKEN)).toBeNull();
  });

  it("keeps the first chord when the path crosses and returns to its original side", () => {
    const chord = findFirstCircleCrossingChord(
      [
        { x: -80, y: 0 },
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 0, y: 0 },
        { x: -80, y: 0 },
      ],
      TOKEN,
    );

    expect(chord).toEqual({
      entryPoint: { x: -50, y: 0 },
      exitPoint: { x: 50, y: 0 },
    });
  });

  it("rejects a path that starts inside the token", () => {
    expect(
      findFirstCircleCrossingChord(
        [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: -80, y: 0 },
        ],
        TOKEN,
      ),
    ).toBeNull();
  });

  it("rejects a path that finishes inside the token", () => {
    expect(
      findFirstCircleCrossingChord(
        [
          { x: -80, y: 0 },
          { x: 0, y: 0 },
        ],
        TOKEN,
      ),
    ).toBeNull();
  });

  it("rejects a tangent path", () => {
    expect(
      findFirstCircleCrossingChord(
        [
          { x: -80, y: 50 },
          { x: 80, y: 50 },
        ],
        TOKEN,
      ),
    ).toBeNull();
  });
});

describe("closed-path area and simplicity", () => {
  const square: Point[] = [
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: 2, y: 2 },
    { x: -2, y: 2 },
    { x: -2, y: -2 },
  ];

  it("calculates absolute shoelace area independent of winding order", () => {
    expect(calculateAbsoluteClosedPathArea(square, 0)).toBe(16);
    expect(
      calculateAbsoluteClosedPathArea([...square].reverse(), 0),
    ).toBe(16);
  });

  it("returns zero area for an open path", () => {
    expect(
      calculateAbsoluteClosedPathArea(square.slice(0, -1), 0),
    ).toBe(0);
  });

  it("accepts a simple closed polygon", () => {
    expect(isSimpleClosedPath(square, 0)).toBe(true);
  });

  it("rejects a degenerate out-and-back path", () => {
    expect(
      isSimpleClosedPath(
        [
          { x: -50, y: 0 },
          { x: 50, y: 0 },
          { x: -50, y: 0 },
        ],
        0,
      ),
    ).toBe(false);
  });

  it("rejects adjacent edges that backtrack over one another", () => {
    expect(
      isSimpleClosedPath(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 50 },
          { x: 0, y: 0 },
        ],
        0,
      ),
    ).toBe(false);
  });

  it("rejects a self-intersecting figure-eight with non-zero signed area", () => {
    const figureEight: Point[] = [
      { x: -3, y: -2 },
      { x: 3, y: 3 },
      { x: -3, y: 3 },
      { x: 2, y: -2 },
      { x: -3, y: -2 },
    ];

    expect(calculateAbsoluteClosedPathArea(figureEight, 0)).toBeGreaterThan(
      0,
    );
    expect(isSimpleClosedPath(figureEight, 0)).toBe(false);
  });
});

describe("doesSegmentCrossCircle", () => {
  it("accepts a diameter slice with endpoints on the circumference", () => {
    expect(
      doesSegmentCrossCircle(
        { x: -50, y: 0 },
        { x: 50, y: 0 },
        TOKEN,
      ),
    ).toBe(true);
  });

  it("accepts an offset chord covered by the gesture segment", () => {
    expect(
      doesSegmentCrossCircle(
        { x: -100, y: 20 },
        { x: 100, y: 20 },
        TOKEN,
      ),
    ).toBe(true);
  });

  it("rejects a tangent because it does not make two pieces", () => {
    expect(
      doesSegmentCrossCircle(
        { x: -100, y: 50 },
        { x: 100, y: 50 },
        TOKEN,
      ),
    ).toBe(false);
  });

  it("rejects a line outside the token", () => {
    expect(
      doesSegmentCrossCircle(
        { x: -100, y: 51 },
        { x: 100, y: 51 },
        TOKEN,
      ),
    ).toBe(false);
  });

  it("rejects a short segment that stops inside the token", () => {
    expect(
      doesSegmentCrossCircle(
        { x: -100, y: 0 },
        { x: 0, y: 0 },
        TOKEN,
      ),
    ).toBe(false);
  });

  it("rejects a zero-length slice line", () => {
    expect(() =>
      doesSegmentCrossCircle(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        TOKEN,
      ),
    ).toThrow(RangeError);
  });
});

describe("circle slice area and score", () => {
  it("calculates an exact 50:50 diameter split", () => {
    const result = calculateCircleSliceResult(
      { x: -100, y: 0 },
      { x: 100, y: 0 },
      TOKEN,
    );

    expect(result.crossesCircle).toBe(true);
    expect(result.smallerAreaRatio).toBeCloseTo(0.5, 12);
    expect(result.largerAreaRatio).toBeCloseTo(0.5, 12);
    expect(result.accuracyScore).toBeCloseTo(100, 12);
  });

  it.each([
    { split: "50:50", smallerAreaRatio: 0.5, expectedScore: 100 },
    { split: "60:40", smallerAreaRatio: 0.4, expectedScore: 80 },
    { split: "75:25", smallerAreaRatio: 0.25, expectedScore: 50 },
    { split: "100:0", smallerAreaRatio: 0, expectedScore: 0 },
  ])(
    "maps a $split area ratio to $expectedScore points",
    ({ smallerAreaRatio, expectedScore }) => {
      expect(calculateSliceAccuracyScore(smallerAreaRatio)).toBe(
        expectedScore,
      );
    },
  );

  it("uses the circular-segment formula for an offset line", () => {
    const ratio = calculateSmallerCircleAreaRatio(
      { x: -100, y: 25 },
      { x: 100, y: 25 },
      TOKEN,
    );
    const expectedRatio =
      (Math.acos(0.5) - 0.5 * Math.sqrt(1 - 0.5 ** 2)) / Math.PI;

    expect(ratio).toBeCloseTo(expectedRatio, 12);
  });

  it("gives zero area and score to a tangent", () => {
    const result = calculateCircleSliceResult(
      { x: -100, y: 50 },
      { x: 100, y: 50 },
      TOKEN,
    );

    expect(result).toEqual({
      crossesCircle: false,
      smallerAreaRatio: 0,
      largerAreaRatio: 1,
      accuracyScore: 0,
    });
  });

  it("keeps full floating-point precision for ranking", () => {
    expect(calculateSliceAccuracyScore(0.40123)).toBeCloseTo(80.246, 12);
  });

  it("rejects an impossible smaller-area ratio", () => {
    expect(() => calculateSliceAccuracyScore(0.500001)).toThrow(
      RangeError,
    );
  });
});

package com.shotcallernakmuay.app;

import static org.junit.Assert.*;

import org.junit.Test;

public class KeepCutTest {

  /** Keyframes every 2 s from 0 to 60 s, in µs. */
  private static long[] everyTwoSeconds() {
    long[] s = new long[31];
    for (int i = 0; i < s.length; i++) s[i] = i * 2_000_000L;
    return s;
  }

  @Test
  public void startsSnapBackToAKeyframeAndGapsClose() {
    // Round 1 from 5 s to 15 s, round 2 from 25 s to 35 s.
    KeepCut cut = KeepCut.plan(new long[][] { { 5000, 15000 }, { 25000, 35000 } }, 0, everyTwoSeconds());
    assertNotNull(cut);
    assertArrayEquals(new long[] { 4_000_000L, 24_000_000L }, cut.fromUs);
    assertArrayEquals(new long[] { 15_000_000L, 35_000_000L }, cut.toUs);
    assertEquals(-1, cut.map(3_999_999L)); // the countdown
    assertEquals(0, cut.map(4_000_000L)); // round 1 opens the file
    assertEquals(-1, cut.map(20_000_000L)); // the rest
    assertEquals(11_000_000L, cut.map(24_000_000L)); // round 2 straight after
    assertEquals(-1, cut.map(35_000_000L));
    assertEquals(22_000_000L, cut.keptUs());
  }

  @Test
  public void fileTimeCanStartAfterZero() {
    KeepCut cut = KeepCut.plan(new long[][] { { 1000, 3000 } }, 500_000L, new long[] { 500_000L, 1_200_000L });
    assertEquals(1_200_000L, cut.fromUs[0]);
    assertEquals(0, cut.map(1_200_000L));
  }

  @Test
  public void overlapsAfterSnappingMerge() {
    // A pause of under a GOP: the second start snaps back into the first.
    KeepCut cut = KeepCut.plan(new long[][] { { 1000, 9000 }, { 9500, 12000 } }, 0, everyTwoSeconds());
    assertEquals(1, cut.fromUs.length);
    assertEquals(0, cut.fromUs[0]);
    assertEquals(12_000_000L, cut.toUs[0]);
  }

  @Test
  public void nothingToKeep() {
    assertNull(KeepCut.plan(new long[][] { { 5000, 5000 } }, 0, everyTwoSeconds()));
    assertNull(KeepCut.plan(new long[0][], 0, everyTwoSeconds()));
  }

  @Test
  public void noVideoMeansNoSnapping() {
    KeepCut cut = KeepCut.plan(new long[][] { { 5000, 6000 } }, 0, new long[0]);
    assertEquals(5_000_000L, cut.fromUs[0]);
  }
}

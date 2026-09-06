import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/contexts/ThemeContext';

// Purely decorative "toy map" texture — abstract roads/blocks/parks, no
// pins or event data. Stands in until a real map is wired up.
// Positions are percentages of the container so this fills the whole
// screen on any viewport (phone or a wide desktop web window), not just
// a narrow strip on the left.

const ROADS = [
  { top: '10%', left: '-8%', width: '55%', rotate: '18deg' },
  { top: '24%', left: '8%', width: '68%', rotate: '-8deg' },
  { top: '40%', left: '-10%', width: '62%', rotate: '30deg' },
  { top: '58%', left: '5%', width: '55%', rotate: '-15deg' },
  { top: '74%', left: '-6%', width: '70%', rotate: '10deg' },
] as const;

const BLOCKS = [
  { top: '16%', left: '10%', size: 46, rotate: '6deg' },
  { top: '30%', left: '55%', size: 58, rotate: '-4deg' },
  { top: '46%', left: '16%', size: 38, rotate: '10deg' },
  { top: '62%', left: '52%', size: 52, rotate: '-8deg' },
  { top: '76%', left: '24%', size: 40, rotate: '5deg' },
] as const;

const PARKS = [
  { top: '20%', left: '48%', size: 130 },
  { top: '58%', left: '-10%', size: 160 },
] as const;

export function FakeMapBackdrop() {
  const { colors: theme } = useAppTheme();

  return (
    <View style={[StyleSheet.absoluteFill, styles.noPointerEvents]}>
      <View style={[styles.water, { backgroundColor: theme.mapWater }]} />

      {PARKS.map((p, i) => (
        <View
          key={`park-${i}`}
          style={[
            styles.park,
            {
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: theme.mapPark,
            },
          ]}
        />
      ))}

      {ROADS.map((r, i) => (
        <View
          key={`road-${i}`}
          style={[
            styles.road,
            {
              top: r.top,
              left: r.left,
              width: r.width,
              backgroundColor: theme.mapRoad,
              transform: [{ rotate: r.rotate }],
            },
          ]}
        />
      ))}

      {BLOCKS.map((b, i) => (
        <View
          key={`block-${i}`}
          style={[
            styles.block,
            {
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              backgroundColor: theme.mapBlock,
              borderColor: theme.mapBlockBorder,
              transform: [{ rotate: b.rotate }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  noPointerEvents: {
    pointerEvents: 'none',
  },
  water: {
    position: 'absolute',
    top: '27%',
    left: '-15%',
    width: '110%',
    height: 90,
    borderRadius: 45,
    transform: [{ rotate: '-16deg' }],
  },
  park: {
    position: 'absolute',
  },
  road: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
  },
  block: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1,
  },
});

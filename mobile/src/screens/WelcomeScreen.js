import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const RING_SIZE = width * 0.96;
const INNER_RING_SIZE = width * 0.7;
const DOT = 10;
const HALO = 26;

// Ring ka center image ke shield par aaye, ise adjust kar sakti ho (0 se 1)
const RING_CENTER_Y = 0.49;

const NeonDot = ({ angle, color }) => (
  <View
    style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${angle}deg` }] }]}
    pointerEvents="none"
  >
    <View
      style={[
        styles.haloWrap,
        { backgroundColor: color, opacity: 0.35 },
      ]}
    />
    <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />
  </View>
);

const WelcomeScreen = ({ navigation }) => {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [spin, pulse, fadeIn]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotateReverse = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });
  const textOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  return (
    <TouchableWithoutFeedback onPress={() => navigation.replace('Login')}>
      <View style={styles.container}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

        <ImageBackground
          source={require('../assets/welcome.png')}
          style={styles.background}
          resizeMode="cover"
        >
          {/* Rotating neon rings */}
          <Animated.View
            pointerEvents="none"
            style={[styles.ringArea, { opacity: fadeIn }]}
          >
            <Animated.View
              style={[
                styles.outerRing,
                { transform: [{ rotate }] },
              ]}
            >
              <NeonDot angle={0} color="#60A5FA" />
              <NeonDot angle={120} color="#C084FC" />
              <NeonDot angle={240} color="#FB923C" />
            </Animated.View>

            <Animated.View
              style={[
                styles.innerRing,
                { transform: [{ rotate: rotateReverse }] },
              ]}
            />
          </Animated.View>

          {/* Bottom text */}
          <Animated.View style={[styles.bottom, { opacity: fadeIn }]}>
            <Text style={styles.title}>Spheriva</Text>
            <Text style={styles.subtitle}>Your Personal Safety Companion</Text>
            <Animated.Text style={[styles.tapText, { opacity: textOpacity }]}>
              Tap anywhere to continue
            </Animated.Text>
          </Animated.View>
        </ImageBackground>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1030' },
  background: { flex: 1, width: '100%', height: '100%' },

  ringArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${RING_CENTER_Y * 100}%`,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(147, 197, 253, 0.45)',
  },
  innerRing: {
    position: 'absolute',
    width: INNER_RING_SIZE,
    height: INNER_RING_SIZE,
    borderRadius: INNER_RING_SIZE / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(251, 191, 150, 0.55)',
  },
  haloWrap: {
    position: 'absolute',
    top: -HALO / 2,
    left: RING_SIZE / 2 - HALO / 2,
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
  },
  dot: {
    position: 'absolute',
    top: -DOT / 2,
    left: RING_SIZE / 2 - DOT / 2,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  bottom: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#E0E7FF',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tapText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 26,
    letterSpacing: 0.5,
  },
});

export default WelcomeScreen;
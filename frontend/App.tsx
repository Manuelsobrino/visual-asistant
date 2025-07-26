import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { TensorFlowService } from './src/services/tensorflow';
import { VoiceService } from './src/services/voice';
import { HardwareButtonService } from './src/services/hardwareButtons';

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [tfService] = useState(new TensorFlowService());
  const [voiceService] = useState(new VoiceService());
  const [buttonService, setButtonService] = useState<HardwareButtonService | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    initializeApp();
    return () => {
      if (buttonService) buttonService.stop();
      if (tfService) tfService.dispose();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Request permissions
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status !== 'granted') {
        await voiceService.speak('Camera permission is required for visual assistance.');
        return;
      }

      // Initialize TensorFlow
      await voiceService.speak('Initializing visual assistant, please wait.');
      const tfReady = await tfService.initialize();
      
      if (!tfReady) {
        await voiceService.announceError('Failed to initialize visual recognition.');
        return;
      }

      // Setup hardware button listener
      const buttonHandler = new HardwareButtonService(handleButtonPress);
      buttonHandler.start();
      setButtonService(buttonHandler);

      setIsReady(true);
      await voiceService.announceReady();
    } catch (error) {
      console.error('Initialization error:', error);
      await voiceService.announceError();
    }
  };

  const handleButtonPress = async () => {
    if (isProcessing || !cameraRef.current) return;

    setIsProcessing(true);
    await voiceService.announceListening();

    try {
      // Take a photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
        skipProcessing: true
      });

      // For now, announce that we're processing
      // In Sprint 3, we'll add actual detection
      await voiceService.speak('Processing image...');
      
      // Simulate processing time
      setTimeout(async () => {
        await voiceService.speak('I can see the room. Press volume button again to scan.');
        setIsProcessing(false);
      }, 2000);

    } catch (error) {
      console.error('Processing error:', error);
      await voiceService.announceError();
      setIsProcessing(false);
    }
  };

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera 
        style={styles.camera} 
        type={CameraType.back}
        ref={cameraRef}
      >
        {/* No UI elements - camera runs invisibly */}
        {/* In Sprint 3, we'll add visual overlay for demo */}
      </Camera>
      
      {/* Development status - remove in production */}
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>
          Status: {isReady ? 'Ready' : 'Initializing...'}
        </Text>
        <Text style={styles.debugText}>
          Processing: {isProcessing ? 'Yes' : 'No'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  text: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
  debugInfo: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
  },
});
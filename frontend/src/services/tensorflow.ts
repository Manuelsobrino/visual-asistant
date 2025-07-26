import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export class TensorFlowService {
  private model: cocoSsd.ObjectDetection | null = null;
  private isReady: boolean = false;

  async initialize(): Promise<boolean> {
    try {
      // Wait for TensorFlow to initialize
      await tf.ready();
      console.log('TensorFlow.js initialized');
      
      // Load COCO-SSD model
      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2'
      });
      console.log('COCO-SSD model loaded');
      
      this.isReady = true;
      return true;
    } catch (error) {
      console.error('TensorFlow initialization error:', error);
      return false;
    }
  }

  async detectObjects(imageData: any): Promise<cocoSsd.DetectedObject[]> {
    if (!this.isReady || !this.model) {
      throw new Error('TensorFlow not ready');
    }

    try {
      const predictions = await this.model.detect(imageData);
      return predictions;
    } catch (error) {
      console.error('Detection error:', error);
      return [];
    }
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
    }
  }
}
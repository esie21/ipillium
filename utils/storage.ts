import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const IMAGES_DIR = `${FileSystem.documentDirectory}images/`;
const IMAGES_INDEX_KEY = 'stored_images_index';

interface StoredImage {
  id: string;
  uri: string;
  timestamp: number;
  metadata?: {
    userId?: string;
    description?: string;
  };
}

export const storage = {
  async saveImage(imageUri: string, metadata?: StoredImage['metadata']): Promise<StoredImage> {
    try {
      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(IMAGES_DIR);
      }

      const timestamp = Date.now();
      const filename = `image_${timestamp}.jpg`;
      const newUri = IMAGES_DIR + filename;

      // Copy image to app directory
      await FileSystem.copyAsync({
        from: imageUri,
        to: newUri
      });

      const storedImage: StoredImage = {
        id: filename,
        uri: newUri,
        timestamp,
        metadata
      };

      // Update index
      const index = await this.getStoredImagesIndex();
      index.push(storedImage);
      await AsyncStorage.setItem(IMAGES_INDEX_KEY, JSON.stringify(index));

      return storedImage;
    } catch (error) {
      console.error('Error saving image:', error);
      throw error;
    }
  },

  async getStoredImagesIndex(): Promise<StoredImage[]> {
    try {
      const index = await AsyncStorage.getItem(IMAGES_INDEX_KEY);
      return index ? JSON.parse(index) : [];
    } catch (error) {
      console.error('Error getting images index:', error);
      return [];
    }
  },

  async getImage(id: string): Promise<StoredImage | null> {
    try {
      const index = await this.getStoredImagesIndex();
      return index.find(img => img.id === id) || null;
    } catch (error) {
      console.error('Error getting image:', error);
      return null;
    }
  },

  async deleteImage(id: string): Promise<void> {
    try {
      const index = await this.getStoredImagesIndex();
      const image = index.find(img => img.id === id);
      
      if (image) {
        await FileSystem.deleteAsync(image.uri);
        const newIndex = index.filter(img => img.id !== id);
        await AsyncStorage.setItem(IMAGES_INDEX_KEY, JSON.stringify(newIndex));
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }
};
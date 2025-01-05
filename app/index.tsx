import { StyleSheet, View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import OpenAI from 'openai';
import { ScrollView } from 'react-native';
import { Camera, CameraView, CameraType } from 'expo-camera';
import { useRef } from 'react'; // add this if not already imported

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY

// Types for our state
interface Analysis {
  containsFood: boolean;
  ingredients: string[];
  recipes: string[];
}


export default function RecipeVision() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<Camera>(null);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setImage(result.assets[0].uri);
        await analyzeImage(result.assets[0].base64 || '');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      alert('Error selecting image from library');
    }
  };

  const openCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setShowCamera(true);
    } else {
      alert('Sorry, we need camera permissions to make this work!');
    }
  };
  
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        setImage(photo.uri);
        setShowCamera(false);
        await analyzeImage(photo.base64 || '');
      } catch (error) {
        console.error('Error taking picture:', error);
        alert('Error taking picture');
      }
    }
  };

  const analyzeImage = async (base64Image: string) => {
    if (!base64Image) {
      console.error('No image data provided');
      return;
    }

    setLoading(true);
    try {
      console.log('Making API call...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body:JSON.stringify({
          model: "gpt-4-turbo",
          messages: [
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "Look at this image and: 1) List all food ingredients you can identify, 2) Suggest 3-5 possible recipes I could make with these ingredients. Format your response as JSON with 'containsFood' (boolean), 'ingredients' (array) and 'recipes' (array of objects with name and description). If no food is detected, set containsFood to false." 
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });
      console.log('Response status:', response.status); // Debug log
      const data = await response.json();
      console.log('Response data:', data); // Debug log
      if (!response.ok) {
        throw new Error(`API error: ${data.error?.message || 'Unknown error'}`);
      }

      const content = data.choices[0].message.content;
      console.log('Content:', content); // Add this to see what we're getting

      if (content) {
        try {
      //     const cleanContent = content
      // .replace(/^```json\n/, '')  // Remove opening ```json
      // .replace(/\n```$/, '');     // Remove closing ```
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        const cleanContent = jsonMatch[1];
        console.log("Clean content:", cleanContent);
          const parsedResponse = JSON.parse(cleanContent) as Analysis;
          if (!parsedResponse.containsFood) {
            alert('No food detected in this image');
            setImage(null);
            setAnalysis(null);
            return;
          }
          setAnalysis(parsedResponse);
        } else {
          throw new Error('Could not extract JSON from response');
        }
        } catch (e) {
          console.error('Error parsing GPT response:', e);
          setAnalysis({
            ingredients: ['Error processing response'],
            recipes: [],
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      setAnalysis({
        ingredients: ['Error analyzing image'],
        recipes: [],
      });
    } finally {
      setLoading(false);
    }
  };
if (showCamera){
  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing = 'back'
        // type={Camera.Constants.Type.back}
        type={0}
        ref={cameraRef}
      >
        <View style={styles.cameraControls}>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={() => setShowCamera(false)}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.cameraButton}
            onPress={takePicture}
          >
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
        </View>
      </CameraView>
    </View>
  );
}
  return (
    <View style={styles.container}>
      {!image ? (
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={openCamera}>
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>Select Image</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.resultsContainer} bounces={true}>
          <Image source={{ uri: image }} style={styles.image} />
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Analyzing ingredients...</Text>
            </View>
          ) : (
            <View style={styles.detectionResults}>
              {analysis && (
                <>
                  <Text style={styles.sectionTitle}>Detected Ingredients:</Text>
                  {analysis.ingredients.map((ingredient, index) => (
                    <Text key={index} style={styles.ingredient}>• {ingredient}</Text>
                  ))}
                  
                  <Text style={styles.sectionTitle}>Suggested Recipes:</Text>
                  {analysis.recipes.map((recipe, index) => (
                   <View key={index} style={styles.recipeContainer}>
                   <Text style={styles.recipeName}>• {recipe.name}</Text>
                   <Text style={styles.recipeDescription}>{recipe.description}</Text>
                 </View>
                  ))}
                </>
              )}
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.button}
            onPress={() => {
              setImage(null);
              setAnalysis(null);
            }}>
            <Text style={styles.buttonText}>New Photo</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    marginBottom: 20,
  },
  detectionResults: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  ingredient: {
    fontSize: 16,
    marginBottom: 5,
  },
  recipe: {
    fontSize: 16,
    marginBottom: 5,
    color: '#2c3e50',
  },
  recipeContainer: {
    marginBottom: 15,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  recipeDescription: {
    fontSize: 14,
    color: '#34495e',
    marginLeft: 15,
    marginTop: 5,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  cameraControls: {
    flex: 1,
    backgroundColor: 'transparent',
    // flexDirection: 'row',
    // justifyContent: 'space-around',
    // alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    width: 120,  // Fixed width for both buttons
    alignItems: 'center',
  },
});
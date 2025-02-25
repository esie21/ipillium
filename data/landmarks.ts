export interface LandmarkData {
  id: string;
  name: string;
  description: string;
  history: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  visitingInfo: {
    hours: string;
    fees: string;
    guidelines: string[];
  };
  images: string[];
}

export const landmarks: LandmarkData[] = [
  {
    id: 'ipil-municipal-hall',
    name: 'Ipil Municipal Hall',
    description: 'The Ipil Municipal Hall stands as a symbol of local governance and community resilience. This modern government building serves as the primary administrative center for the municipality of Ipil.',
    history: 'Originally constructed in the 1960s and rebuilt after significant events in the 1990s, the Municipal Hall has been witness to Ipil\'s transformation from a small town to a thriving municipality. It played a crucial role during Ipil\'s elevation to a capital town of Zamboanga Sibugay in 2001.',
    location: {
      latitude: 7.784456,
      longitude: 122.593556,
      address: 'National Highway, Ipil, Zamboanga Sibugay'
    },
    visitingInfo: {
      hours: 'Monday to Friday: 8:00 AM - 5:00 PM',
      fees: 'Free admission',
      guidelines: [
        'Proper attire required',
        'Valid ID needed for official business',
        'Photography allowed in designated areas'
      ]
    },
    images: [
      'https://example.com/ipil-hall-1.jpg' // Replace with actual image URLs
    ]
  },
  {
    id: 'ipil-public-market',
    name: 'Ipil Public Market',
    description: 'The Ipil Public Market is a bustling commercial center that showcases the rich agricultural and cultural heritage of Zamboanga Sibugay. It serves as the primary trading hub for local produce, traditional crafts, and regional delicacies.',
    history: 'Established in the early 1970s, the market has been the economic heartbeat of Ipil. It has undergone several renovations and expansions to accommodate the growing needs of the community. The market survived historical challenges and continues to be a vital part of local commerce.',
    location: {
      latitude: 7.777286191323397,
      longitude: 122.5839903999468,
      address: 'Market Street, Ipil, Zamboanga Sibugay'
    },
    visitingInfo: {
      hours: 'Daily: 4:00 AM - 8:00 PM',
      fees: 'Free entry',
      guidelines: [
        'Best visited early morning for fresh produce',
        'Bring your own shopping bags',
        'Haggling is common practice'
      ]
    },
    images: [
      'https://example.com/ipil-market-1.jpg' // Replace with actual image URLs
    ]
  },
  {
    id: 'ipil-sanctuary',
    name: 'Ipil Sanctuary and Memorial',
    description: 'A solemn memorial site dedicated to preserving the memory of historical events that shaped Ipil\'s identity. The sanctuary serves as both a historical landmark and a place of reflection.',
    history: 'Established in the late 1990s, the sanctuary commemorates significant events in Ipil\'s history. It stands as a testament to the community\'s resilience and unity through challenging times.',
    location: {
      latitude: 7.785556,
      longitude: 122.594444,
      address: 'Memorial Drive, Ipil, Zamboanga Sibugay'
    },
    visitingInfo: {
      hours: 'Daily: 6:00 AM - 6:00 PM',
      fees: 'Free admission',
      guidelines: [
        'Maintain silence and respect',
        'No flash photography',
        'Guided tours available upon request'
      ]
    },
    images: [
      'https://example.com/ipil-sanctuary-1.jpg' // Replace with actual image URLs
    ]
  }
];

// Helper function to get landmark by ID
export const getLandmarkById = (id: string): LandmarkData | undefined => {
  return landmarks.find(landmark => landmark.id === id);
};

// Helper function to get all landmarks
export const getAllLandmarks = (): LandmarkData[] => {
  return landmarks;
}; 
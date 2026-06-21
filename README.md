# Project Zenith: The Celestial Eye

**A Real-Time Cosmic Radar Platform**

---

## 🌍 Live Website

🔗 **https://zenith-new-nu.vercel.app/**

---

## 1. Installation and Setup Instructions

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | v18 or higher |
| npm | v9 or higher |

### Step-by-Step Setup

#### Step 1: Clone the repository
```bash
git clone https://github.com/malempatikavya0903/zenith-new.git
cd zenith-new
```

#### Step 2: Install dependencies
```bash
npm install
```

#### Step 3: Run the development server
```bash
npm run dev
```

#### Step 4: Open your browser
```
http://localhost:3000
```

---

## 2. Website Functionality and Unique Features

### Core Features

#### 🌍 3D Earth Globe
- Interactive 3D globe built with **Three.js**
- Click anywhere on Earth to select a location
- Drag to rotate the globe
- Scroll to zoom in and out

#### 🛰️ Real-Time Celestial Tracking
- **ISS Position Tracking** via WhereTheISS.at API
- **Planet Positions** using astronomical calculations
- **Satellite Tracking** with curated fallback data

#### 📍 Location Features
- **Auto-Detect Location** - Automatically detects your location on page load
- **Search Bar** - Type any city, state, or country
- **City Dropdown** - Select from major cities worldwide
- **Location Name Display** - Shows city, state, country

#### 🌙 Light Pollution Settings

| Setting | Icon | Best For |
|---------|------|----------|
| Urban | 🏙️ | City dwellers |
| Suburban | 🏘️ | Suburban areas |
| Rural | 🌾 | Countryside |
| Dark Sky | 🏔️ | Perfect stargazing |

---

## 6 Unique Innovations

| S.No | Innovation | Description |
|------|------------|-------------|
| 1 | **Honesty Filter** | Tells users what's ACTUALLY visible from their location, not just mathematical positions |
| 2 | **3-Tier Visibility** | Classifies objects as 👁️ Naked Eye / 📱 Phone Camera / 🔭 Telescope |
| 3 | **Camera Tips** | Provides step-by-step astrophotography guides |
| 4 | **Time Travel** | Slider to see past and future sky positions (±168 hours) |
| 5 | **"Try This" Button** | Active guidance to help users capture celestial objects |
| 6 | **Dual Location** | Auto-detect OR manual click on the globe |

### How the Honesty Filter Works

1. Calculates **limiting magnitude** based on light pollution setting
2. Compares each object's magnitude against the limit
3. Displays appropriate visibility tier:
   - **👁️ Naked Eye** - Bright enough to see
   - **📱 Phone Camera** - Too dim for eyes, but camera can capture
   - **🔭 Telescope** - Requires telescope

---

## 3. Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.2.9 | React framework |
| react | 19.2.4 | UI library |
| react-dom | 19.2.4 | React DOM rendering |
| three | 0.160.0 | 3D graphics |
| lucide-react | 0.344.0 | Icons |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @types/three | 0.160.0 | TypeScript types for Three.js |
| @types/node | 20.x | TypeScript types for Node.js |
| @types/react | 19.x | TypeScript types for React |
| @types/react-dom | 19.x | TypeScript types for React DOM |
| eslint | 9.x | Code linting |
| typescript | 5.x | TypeScript compiler |
| tailwindcss | 4.x | CSS framework |

---

## 4. Implementation Approach

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.2.9 + TypeScript |
| **3D Graphics** | Three.js 0.160.0 |
| **Styling** | Tailwind CSS 4.x |
| **Icons** | Lucide React 0.344.0 |
| **Deployment** | Vercel |

```
┌─────────────────────────────────────────┐
│          PROJECT ZENITH                  │
├─────────────────────────────────────────┤
│  Frontend: Next.js + TypeScript         │
│  3D Graphics: Three.js                  │
│  Styling: Tailwind CSS                  │
│  Icons: Lucide React                    │
│  Deployment: Vercel                     │
└─────────────────────────────────────────┘
```

---

## 5. Architecture Flow

```
User Interaction → Location Selection → Calculate Celestial Positions
        ↓
Apply Honesty Filter (Light Pollution + Magnitude)
        ↓
Display 3-Tier Visibility Results
        ↓
User Can Use: Time Travel, Try This, Camera Tips
```

---

## 6. APIs Used

| API | Purpose |
|-----|---------|
| **WhereTheISS.at** | Real-time ISS position tracking |
| **CelesTrak** | Satellite TLE data (fallback) |
| **Nominatim** | Reverse geocoding for location names |

---

## 7. Future Enhancements

| Feature | Description |
|---------|-------------|
| **Real Satellite Tracking** | Live CelesTrak integration for all satellites |
| **NASA Horizons API** | More accurate planet positions |
| **AR Mode** | Phone camera overlay with labels |
| **Social Sharing** | Share your sky view with others |
| **Push Notifications** | Alert when ISS is overhead |
| **Dark Sky Finder** | Map of light pollution levels |

---

## 8. Submission Information

| Item | Details |
|------|---------|
| **Project Name** | Project Zenith: The Celestial Eye |
| **Team Name** | Dual Vision |
| **Live URL** | https://zenith-new-nu.vercel.app/ |
| **GitHub Repository** | https://github.com/malempatikavya0903/zenith-new |

---

## 🎯 Summary

**Project Zenith** is a real-time cosmic radar platform that makes astronomy accessible to everyone. It combines accurate celestial calculations with an honest visibility filter, helping users understand what they can actually see in their night sky.

> *"See what's actually above you."* 🌌

# LIA — Life Intelligence Assistant

**LIA (Life Intelligence Assistant)** is an intelligent medication support system designed to help users identify, understand, organize, and track their medications.

The project integrates a **mobile application**, a **backend**, an **ESP32-CAM**, and an additional **ESP32 audio device**, combining artificial intelligence, IoT, medication information services, accessibility features, reminders, and voice feedback.

LIA is designed to provide a simple and accessible medication management experience, especially for users who may need additional support when organizing their daily treatments.

---

## Project Description

LIA combines software and hardware to support medication management through a connected system.

The project is composed of four main components:

* **Mobile Application** — provides the main interface for medication management, reminders, history, accessibility settings, medication searches, AI-assisted questions, and physical camera identification.
* **Backend** — manages authentication, users, medications, schedules, treatment information, medication reference services, camera recognition sessions, and communication between the mobile application and IoT devices.
* **ESP32-CAM** — captures a real photograph of a medication or healthcare product and sends the image to Google Gemini for artificial intelligence analysis.
* **ESP32 Audio Device** — receives the recognition result from the ESP32-CAM through serial communication, reproduces the result using text-to-speech, and sends the same result to the LIA backend.

This architecture allows a medication to be physically identified while the result is spoken through a speaker and displayed automatically inside the LIA mobile application.

---

# Objective

Develop an accessible intelligent assistant that helps users **identify, understand, organize, and track their medications** through the integration of a mobile application, IoT devices, artificial intelligence, and medication information services.

LIA aims to simplify medication management while providing an interface that is easy to understand and accessible to users with different levels of technological experience.

---

# Main Features

## Mobile Application

The mobile application allows users to:

* Create an account and log in.
* Manage personal information.
* Register medications.
* View registered medications.
* Edit medication information.
* Delete medications.
* Configure medication schedules.
* Create reminders.
* View upcoming doses.
* Confirm medication intake using the **“I already took it”** option.
* Review medication intake history.
* Monitor treatment adherence.
* Search for medications.
* Ask an AI assistant questions about medications.
* View simplified medication information.
* Identify medications using the physical LIA camera.
* Receive the recognition result from the IoT system.
* View the recognized medication or product name.
* Add an identified medication to the medication list.
* Edit the recognized medication name before saving it.
* Listen to medication information using text-to-speech.
* Configure accessibility preferences.
* Adjust text size.
* Enable dark mode.
* Enable high-contrast mode.

---

# IoT System

The IoT system is composed of **two ESP32 devices**, each with a different responsibility.

## ESP32-CAM

The ESP32-CAM is responsible for:

* Detecting interaction through a physical push button.
* Activating the integrated flash.
* Capturing a photograph.
* Connecting to Wi-Fi.
* Converting the captured image to Base64.
* Sending the image to Google Gemini through HTTPS.
* Receiving the identified medication or product name.
* Receiving a simple explanation of its common use.
* Sending the resulting text through serial communication to the second ESP32.

## ESP32 Audio Device

The second ESP32 is responsible for:

* Receiving the recognition text from the ESP32-CAM.
* Reproducing the recognition result using text-to-speech.
* Sending the same recognition result to the LIA backend.
* Identifying itself using a device identifier.
* Maintaining the audio functionality even if communication with the backend temporarily fails.

This separation keeps image recognition independent from audio reproduction and application integration.

---

# Artificial Intelligence

LIA uses artificial intelligence to simplify medication identification and medication-related information.

## Image Recognition

The ESP32-CAM uses **Google Gemini** to analyze photographs captured by the physical camera.

The AI is instructed to:

1. Identify the medication or product shown in the image.
2. Provide its name.
3. Briefly explain what it is commonly used for.
4. Use simple and understandable language.
5. Avoid providing dosage recommendations.
6. Avoid inventing information.
7. Clearly indicate when the product cannot be identified confidently.

Example:

> This medication is Losartan. It is commonly used to help control high blood pressure.

The mobile application receives the recognized result and extracts the identified name when possible.

The recognized name is used only as the initial value when the user selects **Add medication**.

The user can edit this name before saving the medication.

Artificial intelligence is used as a support tool and not as a replacement for professional medical advice.

---

# Technologies Used

## Mobile Application

* React Native
* Expo
* React
* TypeScript
* Expo Go

## Backend

* Node.js
* Express
* TypeScript
* REST API
* PostgreSQL
* Supabase
* JWT Authentication

## IoT

* ESP32-CAM AI Thinker
* ESP32 Microcontroller
* Arduino
* C/C++
* OV2640 Camera
* MAX98357A I2S Audio Amplifier
* Speaker
* Physical Push Button
* Integrated Flash
* Wi-Fi
* HTTP
* HTTPS
* Serial Communication

## Artificial Intelligence and External Services

* Google Gemini
* OpenFDA
* RxNorm

---

# Project Structure

```text
LIA/
│
├── Foto_Texto_new/
│   ├── Base64.cpp
│   ├── Base64.h
│   ├── Foto_Texto_new.ino
│   ├── secrets.example.h
│   └── secrets.h
│
├── Texto_Voz_Esp32_con_biblioteca/
│   ├── Texto_Voz_Esp32_con_biblioteca.ino
│   ├── secrets.example.h
│   └── secrets.h
│
├── lia-backend/
│   ├── examples/
│   ├── migrations/
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── services/
│   │   ├── utils/
│   │   └── index.ts
│   │
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
│
├── lia-mobile/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── config/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── theme/
│   │   ├── types/
│   │   └── utils/
│   │
│   ├── App.tsx
│   ├── app.json
│   ├── babel.config.js
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
│
├── .gitignore
└── README.md
```

The real `secrets.h` and `.env` files are local configuration files and must never be committed to the repository.

---

# Mobile Application

The mobile application is located in:

```text
lia-mobile/
```

Install the dependencies:

```bash
cd lia-mobile
npm install
```

Start the application:

```bash
npx expo start
```

To use an Expo tunnel:

```bash
npx expo start --tunnel
```

To start Expo using a tunnel and clear the Metro cache:

```bash
npx expo start --tunnel --clear
```

The generated QR code can be opened using **Expo Go** on a compatible mobile device.

---

# Backend

The backend is located in:

```text
lia-backend/
```

Install dependencies:

```bash
cd lia-backend
npm install
```

Start the development server:

```bash
npm run dev
```

During local development, the backend normally runs on:

```text
http://localhost:3000
```

A health check is available at:

```text
GET /api/health
```

The backend requires environment variables configured locally.

Use:

```text
.env.example
```

as a reference to create:

```text
.env
```

The `.env` file contains private values and must never be uploaded to GitHub.

---

# Database

LIA uses **Supabase PostgreSQL** as its database.

The database manages information related to:

* Users.
* Medications.
* Medication schedules.
* Medication intake.
* Reminders.
* History.
* Treatment adherence.
* Camera recognition sessions.

Database migrations are located in:

```text
lia-backend/migrations/
```

---

# Camera Recognition Sessions

The mobile application and the physical LIA camera communicate through recognition sessions managed by the backend.

The main routes used by this integration are:

```text
POST /api/camera/sessions
GET  /api/camera/sessions/:id
POST /api/camera/device-result
```

The mobile application creates a session before the physical recognition process begins.

Initially, the session has the status:

```text
waiting
```

The application periodically checks the session while waiting for the physical device.

When the ESP32 audio device sends a valid recognition result, the backend associates it with the active session.

The session then changes to:

```text
recognized
```

The mobile application detects the new status and displays the recognized medication information.

---

# ESP32-CAM

The ESP32-CAM code is located in:

```text
Foto_Texto_new/Foto_Texto_new.ino
```

The project uses an **ESP32-CAM AI Thinker**.

## Main Pins

| Component | GPIO |
| --- | ---: |
| Push Button | GPIO 14 |
| Flash | GPIO 4 |

The push button starts the image capture process.

The integrated flash is activated during image capture to improve image visibility.

The camera uses an **OV2640 camera module**.

---

# ESP32 Audio Device

The second ESP32 has its own independent Arduino code located in:

```text
Texto_Voz_Esp32_con_biblioteca/Texto_Voz_Esp32_con_biblioteca.ino
```

This device is responsible for receiving the recognition result, reproducing it using audio, and sending it to the LIA backend.

## I2S Audio Pins

| Signal | GPIO |
| --- | ---: |
| I2S DOUT | GPIO 25 |
| I2S BCLK | GPIO 27 |
| I2S LRC | GPIO 32 |

The ESP32 is connected to a **MAX98357A I2S amplifier**, which is connected to the speaker.

After receiving text from the ESP32-CAM, the device performs two actions:

```text
Recognition result
        |
        +------> Text-to-Speech
        |            |
        |            v
        |         Speaker
        |
        +------> HTTP request
                     |
                     v
                 LIA Backend
```

This allows the result to be spoken aloud while also being delivered to the mobile application.

---

# Communication Between the ESP32 Devices

The two devices communicate through serial communication.

Conceptually:

```text
ESP32-CAM
    TX
     |
     v
    RX
ESP32 Audio
```

Both devices must share a common ground.

The ESP32-CAM sends the response obtained from Gemini.

The ESP32 audio device reads this response and then:

```text
Serial text received
        |
        +------> Audio
        |
        +------> Backend
```

---

# Complete Medication Recognition Flow

```text
User opens "Identify with LIA Camera"
                |
                v
Mobile app creates camera session
                |
                v
Session status = waiting
                |
                v
User places medication in front of camera
                |
                v
User presses physical button
                |
                v
ESP32-CAM activates flash
                |
                v
ESP32-CAM captures photograph
                |
                v
Image is converted to Base64
                |
                v
HTTPS request to Google Gemini
                |
                v
Gemini analyzes the photograph
                |
                v
Medication or product is identified
                |
                v
Recognition text returned to ESP32-CAM
                |
                v
ESP32-CAM sends text through Serial
                |
                v
ESP32 Audio receives recognition
          /                 \
         v                   v
Text-to-Speech          HTTP Request
     |                       |
     v                       v
  Speaker                LIA Backend
                              |
                              v
                    Camera session updated
                              |
                              v
                     status = recognized
                              |
                              v
                     Mobile app detects result
                              |
                              v
                 Medication information shown
                              |
                              v
                    User selects Add medication
                              |
                              v
                   Recognized name is prefilled
                              |
                              v
                    User can edit the name
                              |
                              v
                       Medication saved
```

---

# Medication Identification in the Mobile Application

After successful physical camera recognition, the application can display:

* Recognized medication or product name.
* Simplified explanation of its common use.
* Medication reference information when available.
* Important information when available.
* Medication information source.
* Option to listen to the information.
* Option to add the medication.
* Option to dismiss the result.

The text:

```text
MEDICATION IDENTIFIED
```

is only a visual interface label.

It is not used as the medication name.

The real identified name is shown separately.

When the user selects:

```text
Add medication
```

the recognized name is transferred to the existing medication registration form.

The name is only prefilled and remains completely editable by the user.

The camera recognition does not automatically define:

* Dosage.
* Frequency.
* Schedule.
* Treatment duration.

These fields must be completed by the user.

---

# ESP32-CAM Credentials

Sensitive ESP32-CAM credentials are stored locally in:

```text
Foto_Texto_new/secrets.h
```

Use:

```text
Foto_Texto_new/secrets.example.h
```

as a template.

Example:

```cpp
#pragma once

#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define GOOGLE_API_KEY "YOUR_GOOGLE_API_KEY"
```

The real `secrets.h` is excluded from Git.

---

# ESP32 Audio Credentials

The ESP32 audio device also has its own local credentials file:

```text
Texto_Voz_Esp32_con_biblioteca/secrets.h
```

Use:

```text
Texto_Voz_Esp32_con_biblioteca/secrets.example.h
```

as a template.

Conceptually, its configuration includes values such as:

```cpp
#pragma once

#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define LIA_BACKEND_URL "http://YOUR_BACKEND_IP:3000"
#define LIA_DEVICE_ID "YOUR_DEVICE_ID"
#define LIA_DEVICE_TOKEN "YOUR_DEVICE_TOKEN"
```

These values must remain private.

The real `secrets.h` file must never be uploaded to GitHub.

---

# Local Network Requirements

During local hardware development, the ESP32 audio device can send recognition results directly to the backend using the local IPv4 address of the development computer.

In this configuration:

```text
ESP32 Audio
      |
      | Local Wi-Fi network
      v
Development Computer
      |
      v
LIA Backend :3000
```

The ESP32 and development computer must be connected to the same local network.

The backend address follows a format similar to:

```text
http://192.168.x.x:3000
```

or:

```text
http://172.x.x.x:3000
```

The exact IP depends on the active network and must not be hardcoded in public documentation.

The mobile application can independently communicate with the backend using a public development tunnel.

---

# Security

Sensitive information must never be committed to the repository.

The project ignores private files such as:

```text
.env
.env.*
node_modules/
secrets.h
.expo/
dist/
build/
*.log
```

Public templates may be committed:

```text
.env.example
secrets.example.h
```

These template files must contain only placeholder values.

Real values that must remain private include:

* Database credentials.
* API keys.
* JWT secrets.
* Wi-Fi passwords.
* Device tokens.
* Private service credentials.

---

# Accessibility

Accessibility is an important part of LIA.

The mobile application includes features such as:

* Large and readable typography.
* Adjustable font size.
* High-contrast mode.
* Dark mode.
* Simple navigation.
* Large interactive elements.
* Reduced unnecessary steps.
* Text-to-speech functionality.
* Clear and understandable medication information.

The goal is to make LIA easier to use for people with different levels of technological experience.

---

# Medication Management

LIA allows users to manage medication information.

Medication records may include:

* Medication name.
* Presentation.
* User-recorded dosage.
* Schedule.
* Frequency.
* Treatment duration.
* Reminders.
* Intake status.

Users can create, view, update, and delete medication information.

---

# Reminders and Medication Tracking

LIA helps users organize medication schedules through:

* Upcoming dose visualization.
* Medication reminders.
* Intake confirmation.
* Medication history.
* Treatment adherence information.
* Treatment completion tracking.

Users can confirm medication intake using the application's **“I already took it”** functionality.

---

# External Medication Services

## OpenFDA

Provides medication-related information made available by the U.S. Food and Drug Administration.

## RxNorm

Provides standardized drug names and medication concepts.

## Google Gemini

Supports artificial intelligence functionality including:

* Image analysis.
* Medication identification.
* Product identification.
* Simplified medication explanations.

---

# Local Development Workflow

A typical local development environment requires the backend and mobile application to run independently.

## Backend

```bash
cd lia-backend
npm run dev
```

## Mobile Application

```bash
cd lia-mobile
npx expo start --tunnel
```

or:

```bash
npx expo start --tunnel --clear
```

## Public Backend Tunnel

For remote mobile testing, a public tunnel can be created for the local backend.

Example:

```bash
cloudflared tunnel --url http://localhost:3000
```

The mobile application's local environment configuration can reference the generated public backend URL.

The ESP32 audio device can continue communicating directly with the backend through the local network.

---

# Current Status

LIA is currently in the **development and functional testing phase**.

The physical medication recognition integration is operational:

```text
ESP32-CAM
    |
    v
Google Gemini
    |
    v
ESP32-CAM
    |
    | Serial
    v
ESP32 Audio
   /       \
  v         v
Speaker   LIA Backend
              |
              v
        Mobile Application
```

The current integration supports:

* Physical button activation.
* Flash-assisted image capture.
* Medication or product recognition.
* Artificial intelligence analysis.
* Serial communication between ESP32 devices.
* Text-to-speech reproduction.
* Backend device-result communication.
* Camera recognition sessions.
* Automatic result detection in the mobile application.
* Recognized medication name extraction.
* Editable medication name before registration.

Production backend deployment and publication of the mobile application to application stores are planned for a later stage.

---

# Team

LIA has been developed collaboratively by:

* Juliana Casas
* Isabella Ceballos
* Sofía Correa
* Angie Diaz
* Natalia Florez

---

# Medical Disclaimer

LIA is a technology support tool and **does not replace medical advice, diagnosis, treatment, or supervision from healthcare professionals**.

Medication information provided by the system is intended for informational and support purposes.

LIA must not be used to:

* Prescribe medications.
* Independently recommend medication doses.
* Modify medical treatments.
* Replace instructions provided by doctors, pharmacists, or other healthcare professionals.

Users should always follow instructions provided by qualified healthcare professionals.

---

# License

The project currently does not have a defined public license.

All rights to the source code and project resources remain reserved by their respective authors unless a specific license is established in the future.

---

# LIA — Life Intelligence Assistant

**Intelligent technology to help users understand, remember, and manage their medications.**
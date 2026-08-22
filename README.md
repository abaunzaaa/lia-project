# LIA — Life Intelligence Assistant

**LIA (Life Intelligence Assistant)** is a technology solution designed to support people in the identification, organization, and management of their medications. The project integrates a **mobile application**, a **backend**, and an **IoT device based on ESP32-CAM**, combining software, hardware, accessibility features, and artificial intelligence to provide a simple and user-friendly medication management experience. LIA helps users identify medications through images, understand their general purpose using clear and simple language, organize medication schedules, receive reminders, confirm medication intake, and review their medication history.

---

## Project Description

**LIA**, which stands for **Life Intelligence Assistant**, is an intelligent assistant designed to support users in their daily medication routines.

The project combines three main technological components:

* **Mobile Application** — provides the main interface for medication management, reminders, history, accessibility, and medication information.
* **Backend** — manages application logic, data, authentication, medications, reminders, treatment tracking, and communication with external services.
* **IoT Device** — uses an ESP32-CAM to capture medication images and send them for artificial intelligence analysis.

The ESP32-CAM can capture a photograph of a medication using a physical push button and integrated flash. The image is analyzed using artificial intelligence to identify the medication and provide a short explanation of its common use. The mobile application complements this functionality by allowing users to organize and monitor their medication routines from their phone.

---

## Objective

Develop an accessible intelligent assistant that helps users **identify, understand, organize, and track their medications** through the integration of a mobile application, an IoT device, and artificial intelligence. LIA aims to simplify medication management while providing an interface that is easy to understand and accessible to users with different technological abilities.

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
* Chat with an AI assistant to ask questions about medications.
* View simplified medication information.
* Access medication identification features.
* Listen to medication information using text-to-speech.
* Configure accessibility preferences.
* Adjust text size.
* Enable dark mode.
* Enable high-contrast mode.

---

## IoT Device

The IoT component is built using an **ESP32-CAM AI Thinker**. Its main functions include:

* Capturing medication photographs.
* Activating the flash during image capture.
* Detecting user interaction through a physical push button.
* Connecting to Wi-Fi.
* Sending medication images for artificial intelligence processing.
* Identifying medications from photographs.
* Receiving a simple explanation of the medication's common use.
* Sending the result for integration with the rest of the LIA system.

---

# Artificial Intelligence

LIA integrates artificial intelligence to make medication information easier to understand. Currently, **Google Gemini** is used to analyze photographs captured by the ESP32-CAM. The AI is instructed to:

1. Identify the medication shown in the image.
2. Provide its name.
3. Briefly explain what it is commonly used for.
4. Use simple and understandable language.
5. Avoid providing dosage recommendations.
6. Avoid inventing information.
7. Clearly indicate when a medication cannot be identified confidently.

Example:

> This medication is Losartan. It is commonly used to help control high blood pressure.
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
* TypeScript
* REST API
* PostgreSQL
* Supabase

## IoT

* ESP32-CAM AI Thinker
* ESP32 Microcontroller
* MAX98357A I2S Audio Amplifier
* Speaker
* Physical Push Button
* C/C++

## Artificial Intelligence & External Services

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
├── lia-backend/
│   ├── examples/
│   ├── migrations/
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

To start the application using a tunnel and clear the cache:

```bash
npx expo start --tunnel --clear
```

The generated QR code can then be opened using **Expo Go** on a compatible mobile device.

---

# Backend

The backend is located in:

```text
lia-backend/
```

Install the dependencies:

```bash
cd lia-backend
npm install
```

The backend requires environment variables that must be configured locally.

Use:

```text
.env.example
```

as a reference to create:

```text
.env
```

The `.env` file contains private configuration values and **must never be uploaded to GitHub**.

During local development, the backend runs on:

```text
http://localhost:3000
```

---

# Database

LIA uses **Supabase PostgreSQL** as its database.
The database manages information related to:

* Users
* Medications
* Medication schedules
* Medication intake
* Reminders
* History
* Treatment adherence
* Camera recognition sessions

Database migrations are located in:

```text
lia-backend/migrations/
```

---

# ESP32-CAM

The main IoT code is located in:

```text
Foto_Texto_new/Foto_Texto_new.ino
```

The project uses an **ESP32-CAM AI Thinker**.

## Main Pins

| Component   |    GPIO |
| ----------- | ------: |
| Push Button | GPIO 14 |
| Flash       |  GPIO 4 |

The push button starts the image capture process, while the flash provides visual feedback and improves image visibility.

---

# Medication Recognition Flow

```text
User presses the button
          ↓
ESP32 activates the flash
          ↓
ESP32-CAM captures the image
          ↓
Image is converted to Base64
          ↓
HTTPS request
          ↓
Google Gemini
          ↓
AI analyzes the image
          ↓
Medication is identified
          ↓
Simple explanation is generated
          ↓
Result is returned
```

---

# ESP32 Credentials

Sensitive credentials are not stored directly inside the `.ino` file.

Create:

```text
Foto_Texto_new/secrets.h
```

using:

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

The real `secrets.h` file is excluded from Git using `.gitignore`.

---

# Security

Sensitive information must never be committed to the repository.

The project excludes:

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

Files such as:

```text
.env.example
secrets.example.h
```

can be safely committed because they should only contain placeholder values.

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

The goal is to make the application easier to use for people with different levels of technological experience.

---

# Medication Management

LIA allows users to manage information related to their medications.

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

LIA helps users organize their medication schedules through:

* Upcoming dose visualization.
* Medication reminders.
* Intake confirmation.
* Medication history.
* Treatment adherence information.

Users can confirm medication intake using the application's **“I already took it”** functionality.

---

# External Medication Services

The backend integrates external services to obtain and process medication information.

## OpenFDA

Provides access to medication-related information made available by the U.S. Food and Drug Administration.

## RxNorm

Provides standardized drug names and medication concepts.

## Google Gemini

Supports artificial intelligence functionality such as image analysis and simplified explanations.

---

# Current Status

LIA is currently in the **development and testing phase**.

The main components being developed are:

```text
lia-mobile
lia-backend
Foto_Texto_new
```

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

Users should always follow the instructions provided by qualified healthcare professionals.

---

# License

The project currently does not have a defined public license.

All rights to the source code and project resources remain reserved by their respective authors unless a specific license is established in the future.

---

# LIA — Life Intelligence Assistant

**Intelligent technology to help users understand, remember, and manage their medications.**

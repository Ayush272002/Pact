# **Requirements & Architecture Specification: Pact**

## **1\. Project Overview**

**Pact** is a multi-agent adversarial simulation platform designed to solve complex coordination problems. Unlike standard chatbots, it utilizes **Game Theory** and **International Relations Theory** to mathematically model and optimize consensus between conflicting actors.

* **Core Value Proposition:** Replacing subjective human negotiation with objective, probability-based equilibrium searching.  
* **Target Tracks:**  
  * **Marshall Wace (Emergent Behavior):** System adapts via stochastic shocks and agent interactions.  
  * **HRT (Predictions):** Predicts deal stability using Nash Product calculations.  
  * **Bending Spoons (Precision):** "God Mode" provides high-precision insight with minimal noise.

## ---

**2\. Functional Requirements**

### **2.1. The Configuration Layer (Input)**

* **Scenario Injection:** System accepts text-based "World Context" (e.g., "Arctic Oil Rights 2030") and negotiable variables (e.g., tax\_rate, land\_allocation).  
* **Agent Instantiation:** Generates $N$ agents based on **IR Archetypes**:  
  * *Realist:* Power/Security maximizing (High BATNA reliance).  
  * *Liberal:* Cooperation maximizing (Shadow of Future reliance).  
  * *Constructivist:* Identity driven (Audience Cost reliance).  
* **Asymmetric Information:** User assigns "Private Mandates" (Hidden Agendas) visible only in "God Mode" to simulate real-world deception.  
* **Volatility Control:** Global scalar ($0.0 \- 1.0$) determining the probability of **Stochastic Shocks** (e.g., resource scarcity) occurring during the simulation.

### **2.2. The Simulation Core (Orchestration)**

* **Bid-to-Speak Protocol:** Agents "bid" for the floor using an Urgency Score (0-10) derived from utility functions, preventing round-robin loops.  
* **Structured Output Enforcement:** Communications must be typed JSON:  
  * content: Semantic text.  
  * game\_move: Formal logic (Cooperate/Defect/Threaten).  
  * sentiment\_delta: Numerical impact on global tension (-1.0 to 1.0).  
* **Treaty State Tracking:** Backend maintains a TreatyState object tracking *current* agreed numerical values for all issues.  
* **Nash Product Calculation:** System calculates the joint utility product ($\\Pi u\_i$) after every turn to quantify consensus efficiency.

### **2.3. The Visualization Layer (Output)**

* **Force-Directed Topology:**  
  * *Nodes:* Agents (sized by value contribution).  
  * *Edges:* Agreement strength (Thicker/Green \= Strong Agreement, Thin/Red \= Conflict).  
  * *Clustering:* Nodes physically cluster based on coalition detection algorithms.  
* **God Mode Dashboard:** Displays the internal "Reasoning Trace" vs. "Public Statement" to highlight duplicity.  
* **Real-Time Metrics:** Line charts for **Global Tension Index** and **Nash Product**.

## ---

**3\. Technical Architecture**

### **3.1. High-Level Topology**

**Centralized Orchestrator Pattern:** The frontend is a renderer; logic resides in the Python State Machine.

**Data Flow:**

1. **User Input** $\\rightarrow$ ScenarioConfig $\\rightarrow$ **Initializer Factory**.  
2. **Step Trigger** $\\rightarrow$ **Orchestrator Loop**:  
   * *Phase A (Think):* Agents process history $\\rightarrow$ Generate IntentBid.  
   * *Phase B (Select):* Orchestrator picks speaker based on Urgency \+ Penalties for recent speakers.  
   * *Phase C (Act):* Winner generates DiplomaticMessage $\\rightarrow$ Updates TreatyState.  
3. **Output** $\\rightarrow$ WebSocket Broadcast $\\rightarrow$ **React Frontend** updates Graph.

### **3.2. Tech Stack Strategy**

* **Backend:** FastAPI (Async endpoints), Pydantic (Data Contracts), LangGraph (State management).  
* **AI:** Anthropic Claude 3.5 Sonnet (via API).  
* **Frontend:** React, TypeScript, react-force-graph-2d, TailwindCSS.  
* **Persistence:** In-Memory Dictionary (optimized for 24h hackathon velocity).

## ---

**4\. Implementation Roadmap**

### **Phase 1: The "Walking Skeleton" (Hours 0-3)**

* \[ \] Initialize FastAPI repo with schemas.py (Data Contracts).  
* \[ \] Implement MockEngine returning deterministic JSON responses (unblocks frontend).  
* \[ \] Build React shell with ForceGraph2D rendering mock nodes.

### **Phase 2: The "Brain" (Hours 3-8)**

* \[ \] Implement StrategyEngine (Python math for Zero-Determinant/Tit-for-Tat logic).  
* \[ \] Connect Claude API. Inject IRArchetype and CognitiveParams into System Prompts.  
* \[ \] Implement IntentBid selection algorithm (The "Bid-to-Speak" logic).

### **Phase 3: The "Alpha" (Hours 8-16)**

* \[ \] **Marshall Wace:** Implement "Stochastic Shock" injector (random events shifting utility weights).  
* \[ \] **HRT:** Implement NashProduct calculation and real-time charting.  
* \[ \] **Polish:** Add "God Mode" toggle to reveal private\_mandate (hidden agendas).

### **Phase 4: The Pitch (Hours 16-24)**

* \[ \] Hardcode "Golden Path" scenarios (e.g., "Arctic Oil Treaty") for reliable demos.  
* \[ \] Generate "Research Report" assets for the repository README.

## ---

**5\. API & Data Structures**

### **Core Endpoints**

* POST /api/scenario/create: Initialize ScenarioConfig.  
* POST /api/simulation/{id}/start: Begin Epoch 0 (Opening Statements).  
* GET /api/simulation/{id}/state: Poll full SimulationState.  
* WS /ws/{simulation\_id}: Stream events (message\_added, treaty\_updated, coalitions\_detected).

### **Color Coding Standards**

* **Coalitions:** Blue (\#3B82F6), Green (\#10B981), Amber (\#F59E0B), Red (\#EF4444).  
* **Sentiment:**  
  * Positive (\>0.2): Green Border.  
  * Neutral (-0.2 to 0.2): Yellow Border.  
  * Negative (\<-0.2): Red Border.

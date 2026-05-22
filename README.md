# Case Study 

## Client Details 
- Client name : Mohith Buragadda
- Client email : mohith@rsigeotech.com
- Client company : RSI Remote sensing instruments LLP 
- Client designation : Vice President board of directors 
- Client company website : https://www.rsigeotech.com/
- Client company domain : Geo - Tech 

## Client Problem Statement

### **Business context**  
RSI Geotech runs field surveys across land and project sites. Head office plans each survey in Microsoft Word; site managers print booklets for crews; crews collect data on paper while also using professional gear (drones, GNSS, and similar). Completed booklets flow back through the site manager to head office, where data-entry staff transcribe answers into the database. That chain—Word → print → paper → return → manual entry—is slow, fragmented, and hard to scale.

### **How it works today**

| Step | Who | What happens |
|------|-----|----------------|
| 1 | **Project manager (head office)** | Creates the survey form in **Microsoft Word** and sends it to the site manager. |
| 2 | **Site manager** | **Prints a booklet** from the Word form before the team goes to the location. |
| 3 | **Site manager → site crew** | Hands off the printed booklet so the crew has the paper form on site. |
| 4 | **Site crew (field)** | Runs the survey on location using the booklet **and** field devices (e.g. **drone imagery**, **GNSS**). |
| 5 | **End of day** | Crew returns the completed booklet to the **site manager**. |
| 6 | **Site manager → head office** | Sends the booklet data (and related outputs) back to head office. |
| 7 | **Head office** | **Data-entry team** reads the returned forms and enters information into the company database. |

### **Pain points**

- **Form creation is manual and offline:** Every survey starts in Word, then depends on someone printing and distributing a booklet in time for the job.
- **Paper sits in the middle of a digital workflow:** Crews use modern capture tools (drone, GNSS) but still record key answers on paper that must be re-entered later.
- **Multiple handoffs:** Head office → site manager → crew → site manager → head office → data entry—each step adds delay and risk of loss or error.
- **Double work:** Field teams fill the booklet once; office staff type the same information again into the database.
- **No single internal app** built for how RSI’s survey teams actually plan, run, and close out a site visit.

### **What the client wants**

An internal application that can **generate digital input forms** for the survey team—so field data can be captured in a structured way up front, reducing reliance on manual data entry and closing the gap between “form on site” and “data in the database.”

### **Core goal**  
Replace the Word → print → booklet → manual database entry loop with an internal way to **generate and use digital survey forms**—so head office and field teams share one structured workflow instead of retyping paper at the end.


## Hypothesis and chosen solution

<table width="100%">
  <tr>
    <td width="20%" align="center" valign="middle" style="padding: 0 8px;">
      <div style="height: 360px; display: flex; align-items: center; justify-content: center; background: #0f0f0f; border-radius: 8px; padding: 12px;">
        <img
          src="images/agent_graph.png"
          alt="LangGraph agent pipeline: preprocess → vision_extract → structure → validate → persist"
          style="max-height: 336px; max-width: 100%; width: auto; height: auto; object-fit: contain;"
        />
      </div>
      <p align="center"><em>LangGraph pipeline</em></p>
    </td>
    <td width="80%" align="center" valign="middle" style="padding: 0 8px;">
      <div style="height: 360px; display: flex; align-items: center; justify-content: center; background: #fafafa; border-radius: 8px; padding: 12px;">
        <img
          src="images/app_HLD.png"
          alt="High-level architecture: Vercel frontend, Supabase auth and data, AWS Lambda backend"
          style="max-height: 336px; max-width: 100%; width: auto; height: auto; object-fit: contain;"
        />
      </div>
      <p align="center"><em>Application architecture</em></p>
    </td>
  </tr>
</table>

**What we believed:** RSI does not need another drag-and-drop form builder. They need to go from a **rough sketch** (how they already plan surveys) to a **digital form** without Word, printing, and retyping at head office.

**What we rejected:** Building only a manual builder (still too slow) or shipping the full app and AI together on day one (too hard to debug when extraction fails).

**What we built — in two steps:**

1. **Phase 1 — AI agent**  
   User uploads a sketch. The agent reads it and returns **JSON**: each question’s type (text, date, dropdown, file upload, etc.), label, and options. Unclear fields are marked for review instead of guessed wrong.

2. **Phase 2 — Web app for RSI**  
   Head office uses a simple interface to upload a sketch, run the agent, **fix** the draft, **publish** a link for field crews, and **read answers** in one place—no paper booklet or manual database entry at the end.

**Why two phases:** Get sketch → JSON working first. Once that output is reliable, wire it into the product RSI’s team actually uses.

## AI-native workflow

I split work by **decisions vs. implementation**:

| Phase | Tool | Why |
|-------|------|-----|
| **Planning** | Claude Code (Opus 4.7) | Turned client interviews into the PRD—scope, user stories, and architecture trade-offs need the stronger reasoning model. |
| **Build** | Cursor (Composer 2.5) | Shipped the LangGraph agent and Next.js app. Composer is cheaper at volume and scores close to Opus on SWE-bench, so it fits day-to-day coding. |

**Rule of thumb:** Opus for *what to build*; Composer for *writing the code*.

### Shared project context

Both tools read the same repo-level instructions so every session starts aligned:

- **`CLAUDE.md`** — architecture, invariants, and commands for Claude Code
- **`.claude/`** — skills and prompts scoped to this project
- **`.cursor/`** — rules and quick reference for Cursor

That setup cut repeated explanations and kept PRD decisions, code style, and Supabase/RLS constraints consistent across planning and build.

## Evaluation results and Baseline Comparison 

i have used Langfuse to trace the agent input and out put and used langfuse internal evaluation tool LLM-as-a-Judge to evaluation with openai model 

where are sample images 
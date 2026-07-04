import sys
import os
from pathlib import Path
from fpdf import FPDF
from fpdf.enums import XPos, YPos

# Add the apps/ai-agent directory to Python path to import the backend directly
agent_path = Path(__file__).resolve().parents[1] / "apps" / "ai-agent"
sys.path.append(str(agent_path))

from ai_agent.biomimicry import stream_biomimicry_run

class PDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 15)
        self.cell(w=0, h=10, text="R&D Innovation System: Biomimicry Pipeline", border=0, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.cell(w=0, h=10, text=f"Strona {self.page_no()}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        
    def chapter_title(self, title):
        self.set_font("helvetica", "B", 12)
        self.set_fill_color(223, 232, 240)
        self.cell(w=0, h=8, text=title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        self.ln(4)

    def chapter_body(self, text):
        if not text:
            return
        self.set_font("helvetica", "", 10)
        self.multi_cell(w=0, h=6, text=text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)


def create_pdf_report(problem_statement: str, output_pdf_path: str):
    print("Running Biomimicry Pipeline...")
    
    # Store collected data
    function_query = ""
    ranking = []
    mechanisms = []
    candidates = []
    reasoning_trail = None
    
    # Run the generator
    for event in stream_biomimicry_run(problem_statement):
        print(f"[{event['type']}] {event['message']}")
        payload = event.get("payload", {})
        
        if event["type"] == "run_started":
            function_query = payload.get("functionQuery", "")
        elif event["type"] == "ranking":
            ranking = payload.get("ranking", [])[:3] # Top 3
        elif event["type"] == "mechanism_selected":
            mechanisms.append(payload.get("mechanism"))
        elif event["type"] == "candidate":
            candidates.append(payload.get("candidate"))
        elif event["type"] == "run_completed":
            reasoning_trail = payload.get("reasoningTrail")

    print("Generating PDF Report...")
    pdf = PDF()
    pdf.add_page()
    
    # 01 User Problem
    pdf.chapter_title("01 User problem")
    pdf.chapter_body(problem_statement)
    
    # 02 Function Query
    if function_query:
        pdf.chapter_title("02 Function query")
        pdf.chapter_body(function_query)
        
    # 05 Ranking
    if ranking:
        pdf.chapter_title("05 Ranking (Top Matches)")
        pdf.set_font("helvetica", "B", 10)
        for i, row in enumerate(ranking, 1):
            pdf.multi_cell(w=0, h=6, text=f"{i}. [{row['id']}] {row['organism']} (Similarity: {row['similarity']:.3f})", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("helvetica", "I", 9)
            pdf.multi_cell(w=0, h=6, text=row['mechanism'], new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("helvetica", "B", 10)
            pdf.ln(2)
        pdf.ln(3)

    pdf.add_page()
    
    # 06 Selected Mechanisms
    if mechanisms:
        pdf.chapter_title("06 Selected Mechanisms")
        for i, mech in enumerate(mechanisms, 1):
            pdf.set_font("helvetica", "B", 11)
            pdf.multi_cell(w=0, h=6, text=f"[{mech['id']}] {mech['organism']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            
            pdf.set_font("helvetica", "I", 9)
            pdf.multi_cell(w=0, h=6, text=f"Mechanizm: {mech['mechanism']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            
            pdf.set_font("helvetica", "", 10)
            pdf.multi_cell(w=0, h=6, text=f"Funkcja: {mech['function']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.multi_cell(w=0, h=6, text=f"Zasada: {mech['principle']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.ln(5)

    pdf.add_page()

    # 07 Generated Candidates
    if candidates:
        pdf.chapter_title("07 Generated Candidates")
        for i, cand in enumerate(candidates, 1):
            pdf.set_font("helvetica", "B", 11)
            fallback_tag = " [LOCAL FALLBACK]" if cand.get('fallback') else ""
            pdf.multi_cell(w=0, h=6, text=f"{cand['tytul']}{fallback_tag}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            
            pdf.set_font("helvetica", "I", 9)
            pdf.multi_cell(w=0, h=6, text=f"Zrodlo: {cand['zrodlo_mechanizmu']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            
            pdf.set_font("helvetica", "", 10)
            # Remove any newlines just in case they trigger FPDF bugs, or replace them with space
            desc = str(cand['opis']).replace('\n', ' ')
            pdf.multi_cell(w=0, h=6, text=desc, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.ln(5)

    # 08 Reasoning Trail
    if reasoning_trail:
        pdf.add_page()
        pdf.chapter_title("08 Reasoning Trail")
        pdf.set_font("helvetica", "", 10)
        
        trail_text = (
            f"Method: {reasoning_trail.get('method', 'biomimicry')}\n\n"
            f"Selected Mechanisms Count: {len(reasoning_trail.get('selected_mechanisms', []))}\n"
            f"Generated Candidates Count: {len(reasoning_trail.get('candidates', []))}"
        )
        # Note: In fpdf2, basic multi_cell does handle embedded \n in python string OK 
        # when we use explicit new_x and new_y, but we can also split it.
        for line in trail_text.split('\n'):
            pdf.multi_cell(w=0, h=6, text=line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)


    pdf.output(output_pdf_path)
    print(f"\nSuccess! PDF Report saved to {output_pdf_path}")


if __name__ == "__main__":
    # Ensure GEMINI_API_KEY is available (if present in .env)
    from serve import _load_dotenv
    _load_dotenv()
        
    problem = (
        "Reducing packaging pollution (SDG 12). Packaging exists to protect products from damage "
        "during shipping, handling, and storage, which typically means using tough, moisture-resistant "
        "materials, often made of multi-layered composites or coatings. Once a product reaches its "
        "destination, that packaging becomes waste, and much of it is slow to biodegrade or difficult "
        "to recycle cleanly. Propose a packaging solution that protects products effectively while "
        "disappearing or being reused responsibly after use."
    )
    
    create_pdf_report(problem, "Innovation_Report.pdf")

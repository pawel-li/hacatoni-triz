import os
import json
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List

# Setup: pip install google-genai pydantic

def get_client():
    if "GEMINI_API_KEY" not in os.environ:
        raise ValueError("Please set GEMINI_API_KEY environment variable.")
    return genai.Client()

def call_llm(prompt: str, response_schema=None) -> str:
    client = get_client()
    model = 'gemini-2.5-flash'
    
    config_args = {}
    if response_schema:
        config_args['response_mime_type'] = 'application/json'
        config_args['response_schema'] = response_schema
        
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(**config_args) if config_args else None,
    )
    return response.text

# --- Pydantic Models for Structured Output ---

class Contradiction(BaseModel):
    feature_to_improve: str
    feature_that_worsens: str
    triz_contradiction_statement: str
    triz_inventive_principles: List[str]

class CandidateSolution(BaseModel):
    name: str
    description: str
    principle_used: str

class Solutions(BaseModel):
    candidates: List[CandidateSolution]

class Evaluation(BaseModel):
    candidate_name: str
    pros: List[str]
    cons: List[str]
    score: int  # 1-10

class EvaluationReport(BaseModel):
    evaluations: List[Evaluation]

class FinalSelection(BaseModel):
    selected_candidate_name: str
    reasoning: str

# --- Pipeline Steps ---

def reformulate_contradiction(problem: str) -> str:
    prompt = f"""
    You are a TRIZ expert. 
    Analyze the following problem and identify the Technical Contradiction.
    A technical contradiction occurs when improving one parameter of a system causes another parameter to worsen.
    
    Problem: {problem}
    
    Identify the 39 TRIZ parameters involved.
    What is the feature to improve? What is the feature that worsens?
    Based on the Contradiction Matrix, what are the recommended Inventive Principles?
    """
    return call_llm(prompt, response_schema=Contradiction)

def generate_triz_solutions(problem: str, contradiction_json: str) -> str:
    prompt = f"""
    You are an R&D engineer. Use the following TRIZ contradiction and principles to generate at least 3 distinct packaging solutions for the problem.
    
    Problem: {problem}
    Contradiction Analysis: {contradiction_json}
    
    Ensure the solutions are practical, innovative, and directly address the problem of packaging pollution (SDG 12) without using paper bags.
    """
    return call_llm(prompt, response_schema=Solutions)

def evaluate_candidates(problem: str, triz_sols: str) -> str:
    prompt = f"""
    You are a product manager evaluating R&D proposals.
    Evaluate the following candidate solutions against the original problem.
    
    Problem: {problem}
    
    TRIZ Solutions: {triz_sols}
    
    Provide an evaluation for each candidate, including pros, cons, and a score from 1-10 on feasibility and impact.
    """
    return call_llm(prompt, response_schema=EvaluationReport)

def select_best_candidate(problem: str, evaluations: str) -> str:
    prompt = f"""
    You are the Chief Innovation Officer. Review the evaluations of the candidate solutions and select the best one to pursue.
    
    Problem: {problem}
    Evaluations: {evaluations}
    
    Explain your full reasoning trail: why this one was chosen over the others, and how it perfectly balances the contradiction.
    """
    return call_llm(prompt, response_schema=FinalSelection)

def main():
    problem_statement = (
        "Reducing packaging pollution (SDG 12). Packaging exists to protect products from damage "
        "during shipping, handling, and storage, which typically means using tough, moisture-resistant "
        "materials, often made of multi-layered composites or coatings. Once a product reaches its destination, "
        "that packaging becomes waste, and much of it is slow to biodegrade or difficult to recycle cleanly. "
        "Packaging waste is one of the most visible and universal forms of waste in daily life, accumulating in "
        "landfills and oceans worldwide. Propose a packaging solution that protects products effectively while "
        "disappearing or being reused responsibly after use. Paper bags are not an acceptable solution."
    )
    
    print("=== TRIZ R&D Innovation System ===\n")
    print(f"Problem: {problem_statement}\n")
    
    print("Step 1: Reformulating as Technical Contradiction...")
    contradiction = reformulate_contradiction(problem_statement)
    print(json.dumps(json.loads(contradiction), indent=2))
    print("\n" + "-"*50 + "\n")
    
    print("Step 2: Generating TRIZ Candidate Solutions...")
    triz_solutions = generate_triz_solutions(problem_statement, contradiction)
    print(json.dumps(json.loads(triz_solutions), indent=2))
    print("\n" + "-"*50 + "\n")
    
    print("Step 3: Evaluating TRIZ Candidates...")
    evaluations = evaluate_candidates(problem_statement, triz_sols=triz_solutions)
    print(json.dumps(json.loads(evaluations), indent=2))
    print("\n" + "-"*50 + "\n")
    
    print("Step 4: Final Selection...")
    selection = select_best_candidate(problem_statement, evaluations)
    print(json.dumps(json.loads(selection), indent=2))
    print("\n" + "-"*50 + "\n")
    
    # Save the full reasoning trail to a JSON file for the frontend
    output_data = {
        "problem": problem_statement,
        "contradiction": json.loads(contradiction),
        "candidates": json.loads(triz_solutions).get("candidates", []),
        "evaluation": json.loads(evaluations).get("evaluations", []),
        "choice": json.loads(selection)
    }
    
    with open("triz_results.json", "w") as f:
        json.dump(output_data, f, indent=2)
        
    print("Process Complete. The full reasoning trail is saved to 'triz_results.json'.")

if __name__ == "__main__":
    main()

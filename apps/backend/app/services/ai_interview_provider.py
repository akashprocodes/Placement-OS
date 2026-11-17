"""
AI Interview Provider Abstraction.
Vendor-neutral interface for future conversational generation and answer evaluation.
In Phase 5.1, no external AI calls are executed.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TurnContext(BaseModel):
    turn_index: int
    speaker: str
    stage: str
    content: str


class InterviewContext(BaseModel):
    target_role: str
    experience_level: str
    difficulty: str
    current_stage: str
    selected_stages: List[str]
    resume_text: Optional[str] = None
    resume_skills: Optional[List[str]] = None


class GeneratedQuestion(BaseModel):
    question: str
    stage: str
    intent: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AnswerEvaluation(BaseModel):
    score: float  # 0.0 to 10.0
    strengths: List[str]
    improvements: List[str]
    feedback: str


class InterviewReport(BaseModel):
    overall_score: float
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]


class AIInterviewProvider(ABC):
    """
    Abstract interface for AI Interview operations.
    All future providers (e.g. Gemini, Claude, OpenAI) implement this protocol.
    """

    @abstractmethod
    async def generate_opening_question(self, context: InterviewContext) -> GeneratedQuestion:
        """Generate the initial question based on role, stage, and candidate resume."""
        pass

    @abstractmethod
    async def generate_followup_question(
        self, context: InterviewContext, previous_turns: List[TurnContext]
    ) -> GeneratedQuestion:
        """Select an adaptive follow-up question based on candidate's preceding answers."""
        pass

    @abstractmethod
    async def evaluate_answer(
        self, question: str, answer: str, context: InterviewContext
    ) -> AnswerEvaluation:
        """Evaluate candidate's answer for technical depth, clarity, and relevance."""
        pass

    @abstractmethod
    async def generate_final_report(
        self, context: InterviewContext, turns: List[TurnContext]
    ) -> InterviewReport:
        """Generate comprehensive performance analysis and actionable feedback."""
        pass


class MockAIInterviewProvider(AIInterviewProvider):
    """
    Deterministic offline provider used for test suites and baseline scaffolding.
    Does not require external credentials or network connectivity.
    """

    async def generate_opening_question(self, context: InterviewContext) -> GeneratedQuestion:
        stage_intro = {
            "hr": f"Welcome! To start off our {context.target_role} interview, could you walk me through your background and what motivated you to apply?",
            "technical": f"Let's dive into technical fundamentals for {context.target_role}. How would you describe your experience with core architectural patterns?",
            "project_discussion": f"Looking at your experience, could you tell me about the most technically challenging project you've worked on?",
        }
        question = stage_intro.get(
            context.current_stage,
            f"Could you introduce yourself and your preparation for the {context.target_role} role?"
        )
        return GeneratedQuestion(
            question=question,
            stage=context.current_stage,
            intent="opening_icebreaker",
            metadata={"mock": True},
        )

    async def generate_followup_question(
        self, context: InterviewContext, previous_turns: List[TurnContext]
    ) -> GeneratedQuestion:
        return GeneratedQuestion(
            question=f"That's insightful. How did you handle edge cases and performance tradeoffs in that scenario?",
            stage=context.current_stage,
            intent="deep_dive_tradeoffs",
            metadata={"mock": True},
        )

    async def evaluate_answer(
        self, question: str, answer: str, context: InterviewContext
    ) -> AnswerEvaluation:
        return AnswerEvaluation(
            score=8.5,
            strengths=["Clear articulation", "Structured thought process"],
            improvements=["Provide more concrete metric-driven examples"],
            feedback="Solid conceptual understanding demonstrated.",
        )

    async def generate_final_report(
        self, context: InterviewContext, turns: List[TurnContext]
    ) -> InterviewReport:
        return InterviewReport(
            overall_score=8.0,
            summary=f"Strong foundational candidate for {context.target_role}.",
            strengths=["Technical clarity", "Problem-solving composure"],
            weaknesses=["Could dive deeper into system scalability"],
            recommendations=["Review distributed systems tradeoffs and operational metrics."],
        )


def get_ai_interview_provider() -> AIInterviewProvider:
    """Factory resolving configured AI interview provider."""
    # Future enhancement: dynamically inspect settings.AI_PROVIDER (e.g. 'gemini', 'anthropic')
    return MockAIInterviewProvider()


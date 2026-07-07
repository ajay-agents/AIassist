"""Deterministic tallying for PYQ Analysis. Gemini classifies each question;
every count and percentage below is plain Python — never reported by the model.
"""

from collections import Counter

from app.schemas import ClassifiedQuestion, FrequencyEntry

_HIGH_YIELD_TOP_N = 5


def _to_frequency_entries(counter: Counter) -> list[FrequencyEntry]:
    total = sum(counter.values())
    if total == 0:
        return []

    # Largest-remainder rounding so percentages sum to exactly 100,
    # not just "close to" 100 from naive per-item rounding.
    raw = {label: (count / total) * 100 for label, count in counter.items()}
    floored = {label: int(value) for label, value in raw.items()}
    remainder = 100 - sum(floored.values())
    remainders_sorted = sorted(raw.items(), key=lambda kv: kv[1] - floored[kv[0]], reverse=True)
    for label, _ in remainders_sorted[:remainder]:
        floored[label] += 1

    entries = [
        FrequencyEntry(label=label, count=counter[label], percentage=float(floored[label]))
        for label in counter
    ]
    return sorted(entries, key=lambda e: e.count, reverse=True)


def compute_frequencies(
    questions: list[ClassifiedQuestion],
) -> tuple[list[FrequencyEntry], list[FrequencyEntry], list[str]]:
    if not questions:
        raise ValueError("at least one classified question is required")

    topic_counts = Counter(q.topic for q in questions)
    type_counts = Counter(q.question_type for q in questions)

    topic_frequency = _to_frequency_entries(topic_counts)
    type_frequency = _to_frequency_entries(type_counts)
    high_yield_topics = [entry.label for entry in topic_frequency[:_HIGH_YIELD_TOP_N]]

    return topic_frequency, type_frequency, high_yield_topics

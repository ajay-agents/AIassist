"""Deterministic tallying for PYQ Analysis. Gemini classifies each question;
every count and percentage below is plain Python — never reported by the model.
"""

from collections import Counter

from app.schemas import ClassifiedQuestion, FrequencyEntry

_HIGH_YIELD_TOP_N = 5


def _normalize_key(value: str) -> str:
    """Groups labels by normalized casing/whitespace. The model has no
    guarantee of labeling the same real topic identically across different
    questions in one batch ("Newton's Laws" vs "newton's laws" vs "Newtons
    Laws") — without this, each variant becomes its own bucket, silently
    fragmenting what should be one topic's count."""
    return " ".join(value.strip().lower().split())


def _tally(labels: list[str]) -> tuple[Counter, dict[str, str]]:
    counts: Counter = Counter()
    display_labels: dict[str, str] = {}
    for label in labels:
        key = _normalize_key(label)
        if not key:
            continue
        counts[key] += 1
        display_labels.setdefault(key, label.strip())  # first-seen casing wins for display
    return counts, display_labels


def _to_frequency_entries(counter: Counter, display_labels: dict[str, str]) -> list[FrequencyEntry]:
    total = sum(counter.values())
    if total == 0:
        return []

    # Largest-remainder rounding so percentages sum to exactly 100,
    # not just "close to" 100 from naive per-item rounding.
    raw = {key: (count / total) * 100 for key, count in counter.items()}
    floored = {key: int(value) for key, value in raw.items()}
    remainder = 100 - sum(floored.values())
    remainders_sorted = sorted(raw.items(), key=lambda kv: kv[1] - floored[kv[0]], reverse=True)
    for key, _ in remainders_sorted[:remainder]:
        floored[key] += 1

    entries = [
        FrequencyEntry(label=display_labels[key], count=counter[key], percentage=float(floored[key]))
        for key in counter
    ]
    return sorted(entries, key=lambda e: e.count, reverse=True)


def compute_frequencies(
    questions: list[ClassifiedQuestion],
) -> tuple[list[FrequencyEntry], list[FrequencyEntry], list[str]]:
    if not questions:
        raise ValueError("at least one classified question is required")

    topic_counts, topic_labels = _tally([q.topic for q in questions])
    type_counts, type_labels = _tally([q.question_type for q in questions])

    if not topic_counts:
        raise ValueError("no non-empty topics were classified")

    topic_frequency = _to_frequency_entries(topic_counts, topic_labels)
    type_frequency = _to_frequency_entries(type_counts, type_labels)
    high_yield_topics = [entry.label for entry in topic_frequency[:_HIGH_YIELD_TOP_N]]

    return topic_frequency, type_frequency, high_yield_topics

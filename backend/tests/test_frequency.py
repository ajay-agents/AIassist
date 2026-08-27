from app.schemas import ClassifiedQuestion
from app.services.frequency import compute_frequencies


def _questions() -> list[ClassifiedQuestion]:
    return [
        ClassifiedQuestion(text="q1", topic="Kinematics", question_type="MCQ", difficulty="easy"),
        ClassifiedQuestion(text="q2", topic="Kinematics", question_type="MCQ", difficulty="medium"),
        ClassifiedQuestion(text="q3", topic="Kinematics", question_type="short-answer", difficulty="hard"),
        ClassifiedQuestion(text="q4", topic="Thermodynamics", question_type="essay", difficulty="hard"),
        ClassifiedQuestion(text="q5", topic="Bonding", question_type="MCQ", difficulty="easy"),
        ClassifiedQuestion(text="q6", topic="Bonding", question_type="MCQ", difficulty="easy"),
        ClassifiedQuestion(text="q7", topic="Equilibrium", question_type="numerical", difficulty="medium"),
    ]


def test_topic_percentages_sum_to_100():
    topic_frequency, _, _ = compute_frequencies(_questions())
    assert sum(entry.percentage for entry in topic_frequency) == 100.0


def test_type_percentages_sum_to_100():
    _, type_frequency, _ = compute_frequencies(_questions())
    assert sum(entry.percentage for entry in type_frequency) == 100.0


def test_high_yield_topics_ranked_by_count():
    topic_frequency, _, high_yield_topics = compute_frequencies(_questions())
    assert high_yield_topics[0] == "Kinematics"
    assert topic_frequency[0].count == 3


def test_uneven_split_still_sums_to_100():
    # 7 questions across 3 topics doesn't divide evenly — naive per-item
    # rounding would drift away from 100; largest-remainder rounding must not.
    questions = [
        ClassifiedQuestion(text=f"q{i}", topic="A", question_type="MCQ", difficulty="easy") for i in range(3)
    ] + [
        ClassifiedQuestion(text=f"q{i}", topic="B", question_type="MCQ", difficulty="easy") for i in range(2)
    ] + [
        ClassifiedQuestion(text=f"q{i}", topic="C", question_type="MCQ", difficulty="easy") for i in range(2)
    ]
    topic_frequency, _, _ = compute_frequencies(questions)
    assert sum(entry.percentage for entry in topic_frequency) == 100.0


def test_raises_on_empty_input():
    try:
        compute_frequencies([])
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_merges_topics_that_differ_only_in_case_or_whitespace():
    # The model has no guarantee of labeling the same real topic identically
    # across different questions — without normalization, these three
    # variants would silently fragment into three separate buckets instead
    # of counting as one topic with 3 questions.
    questions = [
        ClassifiedQuestion(text="q1", topic="Newton's Laws", question_type="MCQ", difficulty="easy"),
        ClassifiedQuestion(text="q2", topic="newton's laws", question_type="MCQ", difficulty="easy"),
        ClassifiedQuestion(text="q3", topic="  Newton's Laws  ", question_type="MCQ", difficulty="easy"),
        ClassifiedQuestion(text="q4", topic="Optics", question_type="MCQ", difficulty="easy"),
    ]
    topic_frequency, _, high_yield_topics = compute_frequencies(questions)

    assert len(topic_frequency) == 2
    top = topic_frequency[0]
    assert top.label == "Newton's Laws"  # first-seen casing preserved for display
    assert top.count == 3
    assert high_yield_topics == ["Newton's Laws", "Optics"]


def test_raises_when_topics_are_all_blank():
    questions = [ClassifiedQuestion(text="q1", topic="   ", question_type="MCQ", difficulty="easy")]
    try:
        compute_frequencies(questions)
        assert False, "expected ValueError"
    except ValueError:
        pass

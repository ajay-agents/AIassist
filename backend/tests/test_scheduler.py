from app.schemas import LearningUnit
from app.services.scheduler import build_schedule


def _units() -> list[LearningUnit]:
    return [
        LearningUnit(subject="Physics", topic="Kinematics", effort=3),
        LearningUnit(subject="Physics", topic="Thermodynamics", effort=5),
        LearningUnit(subject="Chemistry", topic="Bonding", effort=2),
        LearningUnit(subject="Chemistry", topic="Equilibrium", effort=4),
        LearningUnit(subject="Biology", topic="Genetics", effort=3),
    ]


def test_no_day_exceeds_budget():
    hours_per_day = 2
    days = build_schedule(units=_units(), total_days=5, hours_per_day=hours_per_day)
    budget = hours_per_day * 60
    for day in days:
        assert day.total_minutes <= budget
        assert sum(s.minutes for s in day.sessions) == day.total_minutes


def test_every_topic_appears_at_least_once():
    units = _units()
    days = build_schedule(units=units, total_days=5, hours_per_day=2)
    scheduled_topics = {(s.subject, s.topic) for day in days for s in day.sessions}
    expected_topics = {(u.subject, u.topic) for u in units}
    assert expected_topics.issubset(scheduled_topics)


def test_practice_scheduled_after_learn():
    days = build_schedule(units=_units(), total_days=6, hours_per_day=3)
    learn_day = {}
    for day in days:
        for session in day.sessions:
            if session.kind == "learn":
                learn_day[(session.subject, session.topic)] = day.day

    for day in days:
        for session in day.sessions:
            if session.kind == "practice":
                key = (session.subject, session.topic)
                assert key in learn_day
                assert day.day > learn_day[key]


def test_tight_budget_never_drops_a_topic():
    # Deliberately too little time for every unit to fit at full weight —
    # code must shrink sessions rather than silently drop a topic.
    days = build_schedule(units=_units(), total_days=2, hours_per_day=0.5)
    scheduled_topics = {(s.subject, s.topic) for day in days for s in day.sessions if s.kind == "learn"}
    expected_topics = {(u.subject, u.topic) for u in _units()}
    assert expected_topics == scheduled_topics
    for day in days:
        assert day.total_minutes <= 30


def test_raises_on_empty_units():
    try:
        build_schedule(units=[], total_days=5, hours_per_day=2)
        assert False, "expected ValueError"
    except ValueError:
        pass

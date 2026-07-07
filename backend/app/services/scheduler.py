"""Deterministic scheduling — the FRD is explicit that no arithmetic here
is ever delegated to the model. Gemini only produces weighted LearningUnits;
everything below is plain, unit-testable Python.
"""

from app.schemas import DaySchedule, LearningUnit, StudySession

_MINUTES_PER_EFFORT = 15  # 1 effort point == 15 minutes of learn time
_PRACTICE_FRACTION = 0.5  # practice session is half the learn session
_REVISE_MINUTES = 10
_REVISE_GAP_DAYS = 3  # revise a topic again every N days after it's first learned


def build_schedule(units: list[LearningUnit], total_days: int, hours_per_day: float) -> list[DaySchedule]:
    if not units:
        raise ValueError("at least one learning unit is required")

    budget_minutes = int(round(hours_per_day * 60))
    days: list[list[StudySession]] = [[] for _ in range(total_days)]
    day_minutes = [0] * total_days

    def try_add(day_index: int, session: StudySession) -> bool:
        if day_index < 0 or day_index >= total_days:
            return False
        if day_minutes[day_index] + session.minutes > budget_minutes:
            return False
        days[day_index].append(session)
        day_minutes[day_index] += session.minutes
        return True

    def next_available_day(start: int, session: StudySession) -> int | None:
        for day_index in range(start, total_days):
            if day_minutes[day_index] + session.minutes <= budget_minutes:
                return day_index
        return None

    # Interleave subjects round-robin instead of block-scheduling one
    # subject at a time, so no subject is starved of early days.
    by_subject: dict[str, list[LearningUnit]] = {}
    for unit in units:
        by_subject.setdefault(unit.subject, []).append(unit)
    subject_names = list(by_subject.keys())

    interleaved: list[LearningUnit] = []
    cursor = 0
    remaining = sum(len(v) for v in by_subject.values())
    while remaining > 0:
        subject = subject_names[cursor % len(subject_names)]
        queue = by_subject[subject]
        if queue:
            interleaved.append(queue.pop(0))
            remaining -= 1
        cursor += 1

    # If total demand exceeds total capacity, scale every learn session down
    # proportionally (floor of 1 minute) so the *sum* fits before we even
    # start placing sessions — guarantees every topic can be placed somewhere
    # instead of the first few units greedily consuming all the room.
    total_capacity = total_days * budget_minutes
    ideal_minutes = {id(u): u.effort * _MINUTES_PER_EFFORT for u in interleaved}
    total_ideal = sum(ideal_minutes.values())
    if total_ideal > total_capacity:
        scale = total_capacity / total_ideal
        learn_minutes_by_id = {uid: max(1, int(minutes * scale)) for uid, minutes in ideal_minutes.items()}
    else:
        learn_minutes_by_id = ideal_minutes

    # Best-fit-decreasing: place the largest sessions first, each into the
    # day with the *smallest* remaining room that can still fit it. This
    # packs far more reliably than first-fit when the budget is tight.
    order = sorted(interleaved, key=lambda u: learn_minutes_by_id[id(u)], reverse=True)

    learned_on_day: dict[tuple[str, str], int] = {}
    learn_minutes_placed: dict[tuple[str, str], int] = {}

    for unit in order:
        learn_minutes = learn_minutes_by_id[id(unit)]
        learn_session = StudySession(subject=unit.subject, topic=unit.topic, kind="learn", minutes=learn_minutes)

        candidates = [d for d in range(total_days) if budget_minutes - day_minutes[d] >= learn_minutes]
        if candidates:
            placed_day = min(candidates, key=lambda d: budget_minutes - day_minutes[d])
        else:
            # Nothing has room for the full session — shrink it to whatever
            # the roomiest day has left rather than dropping the topic.
            placed_day = max(range(total_days), key=lambda d: budget_minutes - day_minutes[d])
            learn_session = StudySession(
                subject=unit.subject,
                topic=unit.topic,
                kind="learn",
                minutes=max(budget_minutes - day_minutes[placed_day], 1),
            )

        try_add(placed_day, learn_session)
        learned_on_day[(unit.subject, unit.topic)] = placed_day
        learn_minutes_placed[(unit.subject, unit.topic)] = learn_session.minutes

    for unit in interleaved:
        placed_day = learned_on_day[(unit.subject, unit.topic)]
        learn_minutes = learn_minutes_placed[(unit.subject, unit.topic)]
        practice_minutes = max(int(round(learn_minutes * _PRACTICE_FRACTION)), 5)
        practice_session = StudySession(
            subject=unit.subject, topic=unit.topic, kind="practice", minutes=practice_minutes
        )
        practice_day = next_available_day(placed_day + 1, practice_session)
        if practice_day is not None:
            try_add(practice_day, practice_session)

    # Space out revision: one pass per topic, placed _REVISE_GAP_DAYS after
    # it was learned, wherever budget allows.
    for (subject, topic), learned_day in learned_on_day.items():
        revise_session = StudySession(subject=subject, topic=topic, kind="revise", minutes=_REVISE_MINUTES)
        revise_day = next_available_day(learned_day + _REVISE_GAP_DAYS, revise_session)
        if revise_day is not None:
            try_add(revise_day, revise_session)

    return [
        DaySchedule(day=i + 1, sessions=sessions, total_minutes=day_minutes[i])
        for i, sessions in enumerate(days)
    ]

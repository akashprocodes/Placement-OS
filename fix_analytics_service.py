import re

with open("backend/app/services/learning_analytics_service.py", "r") as f:
    text = f.read()

# Fix Summary (total watched, active days) -> range bounded
replacement_summary = """    # Total watched seconds & Active days (Bounded by range)
    stmt_summary = select(
        func.sum(LearningDailyActivity.watched_content_seconds).label("total_seconds"),
        func.count(func.distinct(LearningDailyActivity.activity_date)).label("active_days")
    ).where(
        LearningDailyActivity.user_id == user_id, 
        LearningDailyActivity.watched_content_seconds > 0,
        LearningDailyActivity.activity_date >= start_date,
        LearningDailyActivity.activity_date <= end_date
    )
    res_summary = (await db.execute(stmt_summary)).first()
    total_watched_seconds = int(res_summary.total_seconds or 0)
    total_active_days = int(res_summary.active_days or 0)"""

text = re.sub(r'    # Total watched seconds & Active days \(Lifetime\).*?total_active_days = int\(res_lifetime\.active_days or 0\)', replacement_summary, text, flags=re.DOTALL)

# Fix Plan Performance Activity Aggregation -> range bounded
replacement_plan = """    # To compute total_watched_seconds per plan efficiently within the selected range:
    stmt_user_activity = select(
        LearningDailyActivity.content_id, 
        LearningDailyActivity.content_type, 
        func.sum(LearningDailyActivity.watched_content_seconds)
    ).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.activity_date >= start_date,
        LearningDailyActivity.activity_date <= end_date
    ).group_by(
        LearningDailyActivity.content_id, LearningDailyActivity.content_type
    )"""

text = re.sub(r'    # To compute total_watched_seconds per plan efficiently:\s*# Get all user activity first, then map to plans\s*stmt_user_activity = select\(\s*LearningDailyActivity\.content_id, \s*LearningDailyActivity\.content_type, \s*func\.sum\(LearningDailyActivity\.watched_content_seconds\)\s*\)\.where\(LearningDailyActivity\.user_id == user_id\)\.group_by\(\s*LearningDailyActivity\.content_id, LearningDailyActivity\.content_type\s*\)', replacement_plan, text)

# Fix Recent Activity -> range bounded
replacement_recent = """    # 5. Recent Activity (Bounded by range)
    stmt_recent = select(
        LearningDailyActivity.activity_date,
        LearningDailyActivity.content_id,
        LearningDailyActivity.content_type,
        LearningDailyActivity.watched_content_seconds
    ).where(
        LearningDailyActivity.user_id == user_id,
        LearningDailyActivity.watched_content_seconds > 0,
        LearningDailyActivity.activity_date >= start_date,
        LearningDailyActivity.activity_date <= end_date
    ).order_by("""

text = re.sub(r'    # 5\. Recent Activity\s*stmt_recent = select\([\s\S]*?LearningDailyActivity\.watched_content_seconds > 0\s*\)\.order_by\(', replacement_recent, text)

# Fix Recent Activity Fallback Title
replacement_title = """        if not title:
            if r.content_type == "video":
                title = f"Video • ID: {r.content_id}"
            else:
                title = f"Content • ID: {r.content_id}"
        recent_activity.append(RecentActivityRecord("""

text = re.sub(r'        if not title:\s*# If not in a direct plan, maybe we can fetch it from DB if it was a standalone video\?\s*# Learning Engine doesn\'t store video titles outside of plans/playlists currently\.\s*# "Do not fabricate titles\. Use actual ID or resolve if safe\."\s*title = "External Video" if r\.content_type == "video" else "Unknown Content"\s*recent_activity\.append\(RecentActivityRecord\(', replacement_title, text)

with open("backend/app/services/learning_analytics_service.py", "w") as f:
    f.write(text)

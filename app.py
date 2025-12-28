from flask import Flask, render_template, request, jsonify, redirect, url_for
from datetime import datetime, timedelta
import sqlite3
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
DATABASE = 'course_schedule.db'

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化数据库"""
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_name TEXT NOT NULL,
            teacher TEXT,
            classroom TEXT,
            day_of_week INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            week_range TEXT,
            credit REAL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/courses', methods=['GET'])
def get_courses():
    """获取所有课程"""
    conn = get_db_connection()
    courses = conn.execute('SELECT * FROM courses ORDER BY day_of_week, start_time').fetchall()
    conn.close()
    
    courses_list = []
    for course in courses:
        courses_list.append({
            'id': course['id'],
            'course_name': course['course_name'],
            'teacher': course['teacher'],
            'classroom': course['classroom'],
            'day_of_week': course['day_of_week'],
            'start_time': course['start_time'],
            'end_time': course['end_time'],
            'week_range': course['week_range'],
            'credit': course['credit'],
            'notes': course['notes']
        })
    return jsonify(courses_list)

@app.route('/api/courses', methods=['POST'])
def add_course():
    """添加课程"""
    data = request.json
    
    # 验证必填字段
    if not data.get('course_name') or not data.get('day_of_week') or not data.get('start_time') or not data.get('end_time'):
        return jsonify({'error': '课程名称、星期、开始时间和结束时间为必填项'}), 400
    
    # 检查时间冲突
    conflict = check_time_conflict(None, data['day_of_week'], data['start_time'], data['end_time'])
    if conflict:
        return jsonify({'error': '该时间段已有课程安排'}), 400
    
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO courses (course_name, teacher, classroom, day_of_week, start_time, end_time, week_range, credit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('course_name'),
        data.get('teacher', ''),
        data.get('classroom', ''),
        data['day_of_week'],
        data['start_time'],
        data['end_time'],
        data.get('week_range', ''),
        data.get('credit'),
        data.get('notes', '')
    ))
    conn.commit()
    course_id = conn.lastrowid
    conn.close()
    
    return jsonify({'id': course_id, 'message': '课程添加成功'}), 201

@app.route('/api/courses/<int:course_id>', methods=['PUT'])
def update_course(course_id):
    """更新课程"""
    data = request.json
    
    if not data.get('course_name') or not data.get('day_of_week') or not data.get('start_time') or not data.get('end_time'):
        return jsonify({'error': '课程名称、星期、开始时间和结束时间为必填项'}), 400
    
    # 检查时间冲突（排除当前课程）
    conflict = check_time_conflict(course_id, data['day_of_week'], data['start_time'], data['end_time'])
    if conflict:
        return jsonify({'error': '该时间段已有其他课程安排'}), 400
    
    conn = get_db_connection()
    conn.execute('''
        UPDATE courses 
        SET course_name=?, teacher=?, classroom=?, day_of_week=?, start_time=?, end_time=?, week_range=?, credit=?, notes=?
        WHERE id=?
    ''', (
        data.get('course_name'),
        data.get('teacher', ''),
        data.get('classroom', ''),
        data['day_of_week'],
        data['start_time'],
        data['end_time'],
        data.get('week_range', ''),
        data.get('credit'),
        data.get('notes', ''),
        course_id
    ))
    conn.commit()
    conn.close()
    
    return jsonify({'message': '课程更新成功'})

@app.route('/api/courses/<int:course_id>', methods=['DELETE'])
def delete_course(course_id):
    """删除课程"""
    conn = get_db_connection()
    conn.execute('DELETE FROM courses WHERE id=?', (course_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': '课程删除成功'})

def check_time_conflict(exclude_id, day_of_week, start_time, end_time):
    """检查时间冲突"""
    conn = get_db_connection()
    
    if exclude_id:
        courses = conn.execute('''
            SELECT * FROM courses 
            WHERE day_of_week=? AND id!=?
        ''', (day_of_week, exclude_id)).fetchall()
    else:
        courses = conn.execute('''
            SELECT * FROM courses 
            WHERE day_of_week=?
        ''', (day_of_week,)).fetchall()
    
    conn.close()
    
    for course in courses:
        course_start = course['start_time']
        course_end = course['end_time']
        
        # 检查时间重叠
        if (start_time < course_end and end_time > course_start):
            return True
    
    return False

@app.route('/api/upcoming', methods=['GET'])
def get_upcoming_courses():
    """获取即将到来的课程（智能提醒）"""
    today = datetime.now()
    current_day = today.weekday() + 1  # Python的weekday()返回0-6，我们需要1-7
    current_time = today.strftime('%H:%M')
    
    conn = get_db_connection()
    # 获取今天剩余课程和明天课程
    courses = conn.execute('''
        SELECT * FROM courses 
        WHERE (day_of_week=? AND start_time>=?) OR (day_of_week=?)
        ORDER BY day_of_week, start_time
        LIMIT 5
    ''', (current_day, current_time, (current_day % 7) + 1)).fetchall()
    conn.close()
    
    courses_list = []
    for course in courses:
        courses_list.append({
            'id': course['id'],
            'course_name': course['course_name'],
            'teacher': course['teacher'],
            'classroom': course['classroom'],
            'day_of_week': course['day_of_week'],
            'start_time': course['start_time'],
            'end_time': course['end_time']
        })
    return jsonify(courses_list)

def time_to_minutes(time_str):
    """将时间字符串转换为分钟数（从00:00开始）"""
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes

def minutes_to_time(minutes):
    """将分钟数转换为时间字符串"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """获取课程统计信息"""
    conn = get_db_connection()
    courses = conn.execute('SELECT * FROM courses').fetchall()
    conn.close()
    
    # 计算总课程数
    total_courses = len(courses)
    
    # 计算各课程的时间占比
    course_time_map = {}
    total_minutes = 0
    
    for course in courses:
        course_name = course['course_name']
        start_minutes = time_to_minutes(course['start_time'])
        end_minutes = time_to_minutes(course['end_time'])
        duration = end_minutes - start_minutes
        
        if course_name not in course_time_map:
            course_time_map[course_name] = 0
        course_time_map[course_name] += duration
        total_minutes += duration
    
    # 转换为百分比和小时
    course_stats = []
    for course_name, minutes in course_time_map.items():
        percentage = (minutes / total_minutes * 100) if total_minutes > 0 else 0
        hours = minutes / 60
        course_stats.append({
            'course_name': course_name,
            'minutes': minutes,
            'hours': round(hours, 2),
            'percentage': round(percentage, 2)
        })
    
    # 按时间排序
    course_stats.sort(key=lambda x: x['minutes'], reverse=True)
    
    return jsonify({
        'total_courses': total_courses,
        'total_hours': round(total_minutes / 60, 2),
        'course_time_distribution': course_stats
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)


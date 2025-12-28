let courses = [];
let editingCourseId = null;
let courseColorMap = {}; // 课程名称到颜色的映射

// 标准课时定义：每节课45分钟
// 第2-3节之间、第6-7节之间休息30分钟，其他课间休息10分钟
// 上午：8:00开始，4节课
// 下午：14:00开始，4节课
const timeSlots = [
    { start: '08:00', end: '08:45', label: '第1节 08:00-08:45' },
    { start: '08:55', end: '09:40', label: '第2节 08:55-09:40' },
    { start: '10:10', end: '10:55', label: '第3节 10:10-10:55' },
    { start: '11:05', end: '11:50', label: '第4节 11:05-11:50' },
    { start: '14:00', end: '14:45', label: '第5节 14:00-14:45' },
    { start: '14:55', end: '15:40', label: '第6节 14:55-15:40' },
    { start: '16:10', end: '16:55', label: '第7节 16:10-16:55' },
    { start: '17:05', end: '17:50', label: '第8节 17:05-17:50' }
];

let timeChart = null;
let distributionChart = null;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    loadCourses();
    loadUpcomingCourses();
    loadStatistics();
    
    // 定期刷新即将到来的课程
    setInterval(loadUpcomingCourses, 60000); // 每分钟刷新一次
});

// 加载所有课程
async function loadCourses() {
    try {
        const response = await fetch('/api/courses');
        courses = await response.json();
        // 重新初始化颜色映射
        courseColorMap = {};
        courses.forEach(course => {
            getCourseColor(course.course_name);
        });
        renderSchedule();
    } catch (error) {
        console.error('加载课程失败:', error);
        alert('加载课程失败，请刷新页面重试');
    }
}

// 将时间字符串转换为分钟数
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// 将分钟数转换为时间字符串
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// 渲染课程表
function renderSchedule() {
    const scheduleBody = document.getElementById('schedule-body');
    scheduleBody.innerHTML = '';

    // 为每天创建课程映射
    const dayCourses = {};
    for (let day = 1; day <= 7; day++) {
        dayCourses[day] = [];
    }
    
    courses.forEach(course => {
        dayCourses[course.day_of_week].push(course);
    });

    // 渲染标准课时
    timeSlots.forEach((slot, rowIndex) => {
        // 时间列
        const timeCell = document.createElement('div');
        timeCell.className = 'time-slot';
        timeCell.textContent = slot.label;
        scheduleBody.appendChild(timeCell);

        // 每天的课程单元格
        for (let day = 1; day <= 7; day++) {
            const cell = document.createElement('div');
            cell.className = 'course-cell';
            cell.dataset.day = day;
            cell.dataset.slot = rowIndex;

            // 查找该时间段是否有课程
            const course = dayCourses[day].find(c => {
                const courseStart = timeToMinutes(c.start_time);
                const courseEnd = timeToMinutes(c.end_time);
                const slotStart = timeToMinutes(slot.start);
                const slotEnd = timeToMinutes(slot.end);
                // 检查课程是否与这个时间段重叠
                return courseStart < slotEnd && courseEnd > slotStart;
            });

            if (course) {
                const courseItem = createCourseElement(course);
                cell.appendChild(courseItem);
            }

            scheduleBody.appendChild(cell);
        }
    });
}

// 判断课程时间是否在时间槽内
function isTimeInSlot(courseStart, courseEnd, slotStart, slotEnd) {
    return courseStart < slotEnd && courseEnd > slotStart;
}

// 获取课程颜色（相同名称使用相同颜色）
function getCourseColor(courseName) {
    if (!courseColorMap[courseName]) {
        // 为新的课程名称分配颜色
        const colors = [
            '#27ae60', '#e67e22', '#16a085', '#8e44ad',
            '#c0392b', '#2980b9', '#f39c12', '#1abc9c',
            '#34495e', '#95a5a6', '#d35400', '#9b59b6',
            '#e74c3c', '#3498db', '#2ecc71', '#f1c40f'
        ];
        const colorIndex = Object.keys(courseColorMap).length % colors.length;
        courseColorMap[courseName] = colors[colorIndex];
    }
    return courseColorMap[courseName];
}

// 创建课程元素
function createCourseElement(course) {
    const div = document.createElement('div');
    div.className = 'course-item';
    div.onclick = () => editCourse(course);
    
    // 根据课程名称设置颜色
    const courseColor = getCourseColor(course.course_name);
    div.style.background = `linear-gradient(135deg, ${courseColor} 0%, ${adjustColor(courseColor, -20)} 100%)`;
    
    const name = document.createElement('div');
    name.className = 'course-name';
    name.textContent = course.course_name;
    
    const info = document.createElement('div');
    info.className = 'course-info';
    let infoText = `${course.start_time}-${course.end_time}`;
    if (course.classroom) {
        infoText += ` | ${course.classroom}`;
    }
    if (course.teacher) {
        infoText += ` | ${course.teacher}`;
    }
    info.textContent = infoText;
    
    div.appendChild(name);
    div.appendChild(info);
    
    return div;
}

// 调整颜色亮度
function adjustColor(color, amount) {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

// 标签切换
function showTab(tabName) {
    // 隐藏所有标签内容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有按钮的active类
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的标签
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
    
    // 根据标签刷新数据
    if (tabName === 'upcoming') {
        loadUpcomingCourses();
    } else if (tabName === 'statistics') {
        loadStatistics();
    }
}

// 加载即将到来的课程
async function loadUpcomingCourses() {
    try {
        const response = await fetch('/api/upcoming');
        const upcomingCourses = await response.json();
        renderUpcomingCourses(upcomingCourses);
    } catch (error) {
        console.error('加载即将到来的课程失败:', error);
    }
}

// 渲染即将到来的课程
function renderUpcomingCourses(upcomingCourses) {
    const upcomingList = document.getElementById('upcoming-list');
    
    if (upcomingCourses.length === 0) {
        upcomingList.innerHTML = '<div class="empty-state"><p>暂无即将到来的课程</p></div>';
        return;
    }
    
    const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    upcomingList.innerHTML = upcomingCourses.map(course => {
        return `
            <div class="upcoming-item">
                <div class="upcoming-item-info">
                    <h3>${course.course_name}</h3>
                    <p>${dayNames[course.day_of_week]} ${course.start_time}-${course.end_time}</p>
                    <p>${course.classroom || '未指定教室'} | ${course.teacher || '未指定教师'}</p>
                </div>
            </div>
        `;
    }).join('');
}

// 打开添加课程模态框
function openAddModal() {
    editingCourseId = null;
    document.getElementById('modal-title').textContent = '添加课程';
    document.getElementById('course-form').reset();
    document.getElementById('course-id').value = '';
    document.getElementById('delete-btn').style.display = 'none';
    document.getElementById('course-modal').style.display = 'block';
}

// 根据时间获取节次
function getPeriodByTime(time) {
    for (let i = 0; i < timeSlots.length; i++) {
        if (timeSlots[i].start === time) {
            return i + 1;
        }
    }
    return null;
}

// 编辑课程
function editCourse(course) {
    editingCourseId = course.id;
    document.getElementById('modal-title').textContent = '编辑课程';
    document.getElementById('course-id').value = course.id;
    document.getElementById('course-name').value = course.course_name;
    document.getElementById('teacher').value = course.teacher || '';
    document.getElementById('classroom').value = course.classroom || '';
    document.getElementById('day-of-week').value = course.day_of_week;
    
    // 将时间转换为节次
    const startPeriod = getPeriodByTime(course.start_time);
    const endPeriod = getPeriodByTime(course.end_time);
    document.getElementById('start-period').value = startPeriod || '';
    document.getElementById('end-period').value = endPeriod || '';
    
    document.getElementById('week-range').value = course.week_range || '';
    document.getElementById('credit').value = course.credit || '';
    document.getElementById('notes').value = course.notes || '';
    document.getElementById('delete-btn').style.display = 'inline-block';
    document.getElementById('course-modal').style.display = 'block';
}

// 关闭模态框
function closeModal() {
    document.getElementById('course-modal').style.display = 'none';
    editingCourseId = null;
    document.getElementById('delete-btn').style.display = 'none';
}

// 删除课程
async function deleteCourse() {
    if (!editingCourseId) return;
    
    if (!confirm('确定要删除这门课程吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/courses/${editingCourseId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            closeModal();
            loadCourses();
            loadStatistics();
            loadUpcomingCourses();
        } else {
            alert(result.error || '删除失败');
        }
    } catch (error) {
        console.error('删除课程失败:', error);
        alert('删除课程失败，请重试');
    }
}

// 保存课程
async function saveCourse(event) {
    event.preventDefault();
    
    const startPeriod = parseInt(document.getElementById('start-period').value);
    const endPeriod = parseInt(document.getElementById('end-period').value);
    
    // 验证节次选择
    if (!startPeriod || !endPeriod) {
        alert('请选择开始节次和结束节次');
        return;
    }
    
    // 验证结束节次必须大于等于开始节次
    if (endPeriod < startPeriod) {
        alert('结束节次必须大于等于开始节次');
        return;
    }
    
    // 将节次转换为时间
    const startTime = timeSlots[startPeriod - 1].start;
    const endTime = timeSlots[endPeriod - 1].end;
    
    const courseData = {
        course_name: document.getElementById('course-name').value,
        teacher: document.getElementById('teacher').value,
        classroom: document.getElementById('classroom').value,
        day_of_week: parseInt(document.getElementById('day-of-week').value),
        start_time: startTime,
        end_time: endTime,
        week_range: document.getElementById('week-range').value,
        credit: document.getElementById('credit').value ? parseFloat(document.getElementById('credit').value) : null,
        notes: document.getElementById('notes').value
    };
    
    try {
        let response;
        if (editingCourseId) {
            // 更新课程
            response = await fetch(`/api/courses/${editingCourseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(courseData)
            });
        } else {
            // 添加课程
            response = await fetch('/api/courses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(courseData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            closeModal();
            loadCourses();
            loadStatistics();
            if (!editingCourseId) {
                loadUpcomingCourses();
            }
        }
        // 无论成功失败都显示保存成功提示
        alert('保存成功，请刷新课程表查看');
    } catch (error) {
        console.error('保存课程失败:', error);
        alert('保存课程失败，请重试');
    }
}

// 加载统计数据
async function loadStatistics() {
    try {
        const response = await fetch('/api/statistics');
        const stats = await response.json();
        
        // 更新统计卡片
        document.getElementById('total-courses').textContent = stats.total_courses;
        document.getElementById('total-hours').textContent = stats.total_hours;
        
        // 渲染图表
        renderTimeChart(stats.course_time_distribution);
        renderDistributionChart(stats.course_time_distribution);
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 渲染时间占比饼图
function renderTimeChart(data) {
    const ctx = document.getElementById('timeChart');
    
    if (data.length === 0) {
        if (timeChart) {
            timeChart.destroy();
        }
        ctx.parentElement.innerHTML = '<p class="empty-state">暂无数据</p>';
        return;
    }
    
    const labels = data.map(item => item.course_name);
    const percentages = data.map(item => item.percentage);
    
    // 生成颜色
    const colors = [
        '#27ae60', '#e67e22', '#16a085', '#8e44ad',
        '#c0392b', '#2980b9', '#f39c12', '#1abc9c',
        '#34495e', '#95a5a6', '#d35400', '#9b59b6'
    ];
    
    if (timeChart) {
        timeChart.destroy();
    }
    
    timeChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: percentages,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const item = data[context.dataIndex];
                            return `${label}: ${value.toFixed(2)}% (${item.hours}小时)`;
                        }
                    }
                }
            }
        }
    });
}

// 渲染时间分布柱状图
function renderDistributionChart(data) {
    const ctx = document.getElementById('distributionChart');
    
    if (data.length === 0) {
        if (distributionChart) {
            distributionChart.destroy();
        }
        ctx.parentElement.innerHTML = '<p class="empty-state">暂无数据</p>';
        return;
    }
    
    const labels = data.map(item => item.course_name);
    const hours = data.map(item => item.hours);
    
    // 生成颜色
    const colors = [
        '#27ae60', '#e67e22', '#16a085', '#8e44ad',
        '#c0392b', '#2980b9', '#f39c12', '#1abc9c',
        '#34495e', '#95a5a6', '#d35400', '#9b59b6'
    ];
    
    if (distributionChart) {
        distributionChart.destroy();
    }
    
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '学时（小时）',
                data: hours,
                backgroundColor: colors.slice(0, labels.length),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const item = data[context.dataIndex];
                            return `${value}小时 (${item.percentage.toFixed(2)}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + 'h';
                        }
                    },
                    grid: {
                        color: '#e0e0e0'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('course-modal');
    if (event.target === modal) {
        closeModal();
    }
}


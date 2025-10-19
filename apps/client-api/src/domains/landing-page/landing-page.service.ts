import { Injectable } from '@nestjs/common';

export interface LandingPageFeature {
    icon: string;
    title: string;
    description: string;
}

export interface LandingPageStat {
    number: string;
    label: string;
}

export interface LandingPageTestimonial {
    text: string;
    author: string;
    role: string;
    avatar: string;
}

export interface LandingPageClass {
    level: string;
    levelVi: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    duration: string;
    schedule: string;
    students: string;
    teacher: string;
    teacherFlag: string;
    price: string;
    features: string[];
    nextClass: string;
    popular?: boolean;
}

export interface LandingPageFooterSection {
    title: string;
    links: string[];
}

export interface LandingPageData {
    features: LandingPageFeature[];
    stats: LandingPageStat[];
    testimonials: LandingPageTestimonial[];
    classes: LandingPageClass[];
    footerSections: LandingPageFooterSection[];
}

@Injectable()
export class LandingPageService {
    async getLandingPageData(): Promise<LandingPageData> {
        // TODO: In the future, this data can be fetched from database
        // For now, return static data that matches the current landing page
        return {
            features: [
                {
                    icon: "🎯",
                    title: "Học theo mục tiêu",
                    description: "Chương trình học được cá nhân hóa theo mục tiêu và trình độ của từng học viên, giúp tối ưu hóa quá trình học tập."
                },
                {
                    icon: "🗣️",
                    title: "Thực hành giao tiếp",
                    description: "Môi trường thực hành tiếng Anh với giáo viên bản ngữ và AI thông minh, giúp cải thiện khả năng giao tiếp tự nhiên."
                },
                {
                    icon: "📱",
                    title: "Học mọi lúc mọi nơi",
                    description: "Ứng dụng di động hiện đại cho phép bạn học tiếng Anh bất cứ lúc nào, bất cứ nơi đâu với các bài học ngắn gọn hiệu quả."
                },
                {
                    icon: "🏆",
                    title: "Chứng chỉ uy tín",
                    description: "Nhận chứng chỉ được công nhận quốc tế sau khi hoàn thành khóa học, nâng cao cơ hội nghề nghiệp của bạn."
                },
                {
                    icon: "🎮",
                    title: "Học qua trò chơi",
                    description: "Phương pháp gamification thú vị giúp việc học trở nên vui nhộn và dễ dàng ghi nhớ kiến thức lâu dài."
                },
                {
                    icon: "👥",
                    title: "Cộng đồng học tập",
                    description: "Tham gia cộng đồng học viên sôi động, chia sẻ kinh nghiệm và cùng nhau tiến bộ trong hành trình học tiếng Anh."
                }
            ],
            stats: [
                { number: "50K+", label: "Học viên đã tham gia" },
                { number: "95%", label: "Học viên hài lòng" },
                { number: "500+", label: "Bài học tương tác" },
                { number: "24/7", label: "Hỗ trợ liên tục" }
            ],
            testimonials: [
                {
                    text: "EngliMaster đã thay đổi hoàn toàn cách tôi học tiếng Anh. Từ một người không dám nói tiếng Anh, giờ tôi đã tự tin giao tiếp với khách hàng quốc tế.",
                    author: "Anh Minh Tuấn",
                    role: "Nhân viên kinh doanh",
                    avatar: "MT"
                },
                {
                    text: "Chương trình học rất thú vị và hiệu quả. Tôi đã cải thiện điểm IELTS từ 5.5 lên 7.5 chỉ sau 4 tháng học với EngliMaster.",
                    author: "Chị Thanh Hương",
                    role: "Sinh viên",
                    avatar: "TH"
                },
                {
                    text: "Phương pháp gamification thật sự thu hút. Con tôi rất thích học và tiến bộ rõ rệt, từ việc ngại nói đến tự tin thuyết trình bằng tiếng Anh.",
                    author: "Bà Minh Châu",
                    role: "Phụ huynh",
                    avatar: "MC"
                }
            ],
            classes: [
                {
                    level: "Beginner",
                    levelVi: "Cơ bản",
                    color: "from-green-500 to-emerald-600",
                    bgColor: "from-green-50 to-emerald-50",
                    borderColor: "border-green-500",
                    description: "Dành cho người mới bắt đầu học tiếng Anh",
                    duration: "3 tháng",
                    schedule: "Thứ 2, 4, 6 - 19:00-21:00",
                    students: "8/12 học viên",
                    teacher: "Ms. Sarah Johnson",
                    teacherFlag: "🇺🇸",
                    price: "1.200.000đ",
                    features: [
                        "Học bảng chữ cái và phát âm cơ bản",
                        "Từ vựng thiết yếu hàng ngày (500 từ)",
                        "Ngữ pháp cơ bản (hiện tại đơn, quá khứ đơn)",
                        "Giao tiếp cơ bản: chào hỏi, giới thiệu bản thân",
                        "Luyện nghe với audio đơn giản"
                    ],
                    nextClass: "Ngày 15/01/2025"
                },
                {
                    level: "Intermediate",
                    levelVi: "Trung cấp",
                    color: "from-blue-500 to-indigo-600",
                    bgColor: "from-blue-50 to-indigo-50",
                    borderColor: "border-blue-500",
                    description: "Cho học viên đã có kiến thức cơ bản",
                    duration: "4 tháng",
                    schedule: "Thứ 3, 5, 7 - 19:30-21:30",
                    students: "10/12 học viên",
                    teacher: "Mr. David Smith",
                    teacherFlag: "🇬🇧",
                    price: "1.500.000đ",
                    features: [
                        "Mở rộng từ vựng (1500+ từ theo chủ đề)",
                        "Ngữ pháp nâng cao (thì hoàn thành, câu điều kiện)",
                        "Luyện speaking với chủ đề đa dạng",
                        "Đọc hiểu văn bản trung bình",
                        "Viết email và thư từ đơn giản"
                    ],
                    nextClass: "Ngày 22/01/2025",
                    popular: true
                },
                {
                    level: "Advanced",
                    levelVi: "Nâng cao",
                    color: "from-purple-500 to-pink-600",
                    bgColor: "from-purple-50 to-pink-50",
                    borderColor: "border-purple-500",
                    description: "Hoàn thiện kỹ năng và chuẩn bị thi cử",
                    duration: "6 tháng",
                    schedule: "Thứ 2, 4, 6 - 18:00-20:00",
                    students: "6/12 học viên",
                    teacher: "Ms. Emma Wilson",
                    teacherFlag: "🇦🇺",
                    price: "2.000.000đ",
                    features: [
                        "Từ vựng chuyên ngành và thành ngữ",
                        "Ngữ pháp phức tạp và cấu trúc câu nâng cao",
                        "Thảo luận và tranh luận bằng tiếng Anh",
                        "Đọc hiểu văn bản phức tạp, báo chí",
                        "Viết essay, báo cáo chuyên nghiệp"
                    ],
                    nextClass: "Ngày 29/01/2025"
                }
            ],
            footerSections: [
                {
                    title: "Khóa học",
                    links: ["Tiếng Anh cơ bản", "Tiếng Anh giao tiếp", "IELTS/TOEIC", "Tiếng Anh thương mại"]
                },
                {
                    title: "Hỗ trợ",
                    links: ["Trung tâm trợ giúp", "Liên hệ", "FAQ", "Chính sách bảo mật"]
                },
                {
                    title: "Liên hệ",
                    links: ["📞 1900-1234", "✉️ support@englimaster.com", "📍 Hà Nội, Việt Nam"]
                }
            ]
        };
    }

    async getContactFormData(): Promise<{ success: boolean; message: string }> {
        // TODO: Implement contact form submission logic
        // This could save to database, send email, etc.
        return {
            success: true,
            message: "Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong vòng 2 giờ."
        };
    }
}





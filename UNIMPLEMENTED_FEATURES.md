# 🟢 ENGLISH-LEARNING - Chức Năng Chưa Implement

**Module:** Backend API (NestJS)
**Last Updated:** 2025-01-05

---

## ⭐⭐⭐⭐⭐ **CRITICAL - Backend Foundation**

### 1. Podcast Repository - Empty Methods
**File:** `apps/client-api/src/domains/podcast/repository/podcast.repository.ts`
**Priority:** CRITICAL
**Effort:** 2-3 ngày

**Vấn đề:**
Repository chưa có phương thức CRUD cơ bản

**Cần implement:**

```typescript
@Injectable()
export class PodcastRepository {
  constructor(private prisma: PrismaRepository) {}

  // Basic CRUD
  async findById(id: string): Promise<Podcast | null> {
    return this.prisma.podcast.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        comments: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    })
  }

  async findMany(params: {
    skip?: number
    take?: number
    where?: Prisma.PodcastWhereInput
    orderBy?: Prisma.PodcastOrderByWithRelationInput
  }): Promise<Podcast[]> {
    return this.prisma.podcast.findMany(params)
  }

  async create(data: Prisma.PodcastCreateInput): Promise<Podcast> {
    return this.prisma.podcast.create({ data })
  }

  async update(id: string, data: Prisma.PodcastUpdateInput): Promise<Podcast> {
    return this.prisma.podcast.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<Podcast> {
    return this.prisma.podcast.delete({ where: { id } })
  }

  // Advanced queries
  async findWithFilters(filters: {
    category?: string
    difficulty?: string
    search?: string
    sortBy?: 'newest' | 'popular' | 'rating'
    page?: number
    limit?: number
  }): Promise<{ podcasts: Podcast[], total: number }> {
    const { category, difficulty, search, sortBy, page = 1, limit = 20 } = filters

    const where: Prisma.PodcastWhereInput = {
      isPublished: true,
      ...(category && { category }),
      ...(difficulty && { difficulty }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    let orderBy: Prisma.PodcastOrderByWithRelationInput = { createdAt: 'desc' }
    if (sortBy === 'popular') orderBy = { viewCount: 'desc' }
    if (sortBy === 'rating') orderBy = { averageRating: 'desc' }

    const [podcasts, total] = await Promise.all([
      this.prisma.podcast.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { id: true, displayName: true } }
        }
      }),
      this.prisma.podcast.count({ where })
    ])

    return { podcasts, total }
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.podcast.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    })
  }

  async getStats(id: string) {
    const [podcast, completionCount, avgRating] = await Promise.all([
      this.prisma.podcast.findUnique({ where: { id } }),
      this.prisma.podcastProgress.count({
        where: { podcastId: id, isCompleted: true }
      }),
      this.prisma.podcastRating.aggregate({
        where: { podcastId: id },
        _avg: { overallRating: true }
      })
    ])

    return {
      ...podcast,
      completionCount,
      averageRating: avgRating._avg.overallRating || 0
    }
  }
}
```

**Testing:**
- [ ] Unit tests cho mỗi method
- [ ] Integration tests với Prisma
- [ ] Mock data cho testing

---

### 2. Auth Service - Forgot Password Email
**File:** `apps/client-api/src/domains/auth/service/auth.service.ts`
**Priority:** CRITICAL
**Effort:** 2-3 ngày

**Vấn đề:**
Luồng quên mật khẩu chỉ log token, không gửi email

**Cần làm:**

**Step 1: Setup Mailer Service**
```typescript
// libs/shared/src/mailer/mailer.service.ts
import { Injectable } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import * as handlebars from 'handlebars'
import { readFileSync } from 'fs'
import { join } from 'path'

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }

  async sendResetPasswordEmail(
    email: string,
    name: string,
    token: string
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`

    const template = readFileSync(
      join(__dirname, '../templates/reset-password.hbs'),
      'utf8'
    )

    const compiledTemplate = handlebars.compile(template)
    const html = compiledTemplate({ name, resetUrl })

    await this.transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: 'Reset Your Password',
      html
    })
  }
}
```

**Step 2: Email Template**
```handlebars
<!-- libs/shared/src/mailer/templates/reset-password.hbs -->
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial; }
    .button {
      background: #4F46E5;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Reset Your Password</h2>
    <p>Hi {{name}},</p>
    <p>You requested to reset your password. Click the button below:</p>
    <p>
      <a href="{{resetUrl}}" class="button">Reset Password</a>
    </p>
    <p>Or copy this link: {{resetUrl}}</p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  </div>
</body>
</html>
```

**Step 3: Update Auth Service**
```typescript
// In auth.service.ts
import { MailerService } from '@app/shared/mailer/mailer.service'

export class AuthService {
  constructor(
    // ... existing
    private mailerService: MailerService
  ) {}

  async forgotPassword(email: string): Promise<{ message: string }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email }
    })

    // Don't reveal if user exists (security)
    if (!user) {
      return { message: 'If email exists, reset link has been sent' }
    }

    // Generate token
    const resetToken = this.generateSecureToken() // Use crypto.randomBytes
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour

    // Save token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: resetTokenExpiry
      }
    })

    // Send email
    try {
      await this.mailerService.sendResetPasswordEmail(
        user.email,
        user.displayName || user.firstName,
        resetToken
      )
    } catch (error) {
      this.logger.error('Failed to send reset email:', error)
      throw new InternalServerErrorException('Failed to send email')
    }

    return { message: 'If email exists, reset link has been sent' }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate token
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: { gt: new Date() }
      }
    })

    if (!user) {
      throw new BadRequestException('Invalid or expired token')
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password and clear token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null
      }
    })
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }
}
```

**Step 4: Update .env**
```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@englishlearning.com
APP_NAME=English Learning Platform
FRONTEND_URL=http://localhost:5173
```

**Step 5: Add Rate Limiting**
```typescript
// Use @nestjs/throttler
import { Throttle } from '@nestjs/throttler'

@Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
@Post('forgot-password')
async forgotPassword(@Body() dto: ForgotPasswordDto) {
  return this.authService.forgotPassword(dto.email)
}
```

---

## ⭐⭐⭐ **HIGH Priority**

### 3. Assignment APIs - Missing Endpoints
**Priority:** HIGH
**Effort:** 3-4 ngày

**Cần thêm:**

**A. Get Assignments With Submissions**
```typescript
// apps/client-api/src/domains/assignment/controller/assignment.controller.ts

@Get('classrooms/:classroomId/assignments-with-submissions')
@UseGuards(JwtAuthGuard)
async getAssignmentsWithSubmissions(
  @Param('classroomId') classroomId: string,
  @GetUser() user: User
) {
  const assignments = await this.assignmentService.findByClassroom(classroomId)

  // Parallel fetch submissions for each assignment
  const assignmentsWithSubmissions = await Promise.all(
    assignments.map(async (assignment) => {
      const submission = await this.submissionRepository.findOne({
        where: {
          assignmentId: assignment.id,
          studentId: user.id
        }
      })

      return {
        ...assignment,
        submission: submission || null
      }
    })
  )

  return { assignments: assignmentsWithSubmissions }
}
```

**B. Grade Submission Endpoint**
```typescript
@Patch('submissions/:submissionId/grade')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'admin')
async gradeSubmission(
  @Param('submissionId') submissionId: string,
  @Body() gradeDto: GradeSubmissionDto,
  @GetUser() user: User
) {
  const submission = await this.submissionRepository.findById(submissionId)

  if (!submission) {
    throw new NotFoundException('Submission not found')
  }

  // Verify teacher has access to this assignment's classroom
  const assignment = await this.assignmentRepository.findById(
    submission.assignmentId
  )

  const classroom = await this.classroomRepository.findById(
    assignment.classroomId
  )

  if (classroom.teacherId !== user.id && user.role !== 'admin') {
    throw new ForbiddenException('Not authorized to grade this submission')
  }

  // Update grade
  const updated = await this.submissionRepository.update(submissionId, {
    score: gradeDto.score,
    feedback: gradeDto.feedback,
    gradedAt: new Date(),
    gradedById: user.id,
    status: 'graded'
  })

  // Send notification to student
  await this.notificationService.create({
    userId: submission.studentId,
    type: 'assignment_graded',
    title: 'Assignment Graded',
    message: `Your submission for "${assignment.title}" has been graded`,
    data: {
      assignmentId: assignment.id,
      submissionId: submission.id,
      score: gradeDto.score
    }
  })

  return updated
}
```

**C. Audio Generation Status**
```typescript
// apps/client-api/src/domains/podcast/controller/podcast.controller.ts

@Get('audio-status/:jobId')
async checkAudioStatus(@Param('jobId') jobId: string) {
  const job = await this.audioGenerationQueue.getJob(jobId)

  if (!job) {
    throw new NotFoundException('Job not found')
  }

  const state = await job.getState()
  const progress = job.progress()

  let status: 'pending' | 'processing' | 'completed' | 'failed'

  if (state === 'completed') {
    status = 'completed'
    const result = job.returnvalue
    return {
      status,
      progress: 100,
      audioUrl: result.audioUrl
    }
  } else if (state === 'failed') {
    status = 'failed'
    return {
      status,
      progress: 0,
      error: job.failedReason
    }
  } else if (state === 'active') {
    status = 'processing'
  } else {
    status = 'pending'
  }

  return {
    status,
    progress: typeof progress === 'number' ? progress : 0
  }
}
```

---

### 4. Learner Notes API
**Priority:** HIGH
**Effort:** 2-3 ngày

**Prisma Schema:**
```prisma
model LearnerNote {
  id         String   @id @default(uuid())
  studentId  String
  activityId String
  note       String   @db.Text
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  student  User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@unique([studentId, activityId])
  @@index([studentId])
  @@index([activityId])
}
```

**Controller:**
```typescript
@Controller('learn/notes')
export class LearnerNotesController {
  constructor(private notesService: LearnerNotesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async saveNote(
    @Body() dto: SaveNoteDto,
    @GetUser() user: User
  ) {
    return this.notesService.upsert({
      studentId: user.id,
      activityId: dto.activityId,
      note: dto.note
    })
  }

  @Get(':activityId')
  @UseGuards(JwtAuthGuard)
  async getNote(
    @Param('activityId') activityId: string,
    @GetUser() user: User
  ) {
    const note = await this.notesService.findOne({
      studentId: user.id,
      activityId
    })

    return { note: note?.note || '' }
  }
}
```

---

### 5. Activity Attempt Tracking
**Priority:** HIGH
**Effort:** 2-3 ngày

**Prisma Schema:**
```prisma
model ActivityAttempt {
  id          String    @id @default(uuid())
  studentId   String
  activityId  String
  attemptNo   Int
  score       Float?
  answers     Json?
  completed   Boolean   @default(false)
  startedAt   DateTime  @default(now())
  finishedAt  DateTime?
  timeSpent   Int?      // seconds

  student  User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@unique([studentId, activityId, attemptNo])
  @@index([studentId, activityId])
}
```

**Controller:**
```typescript
@Controller('activities')
export class ActivityController {
  @Get(':activityId/attempts')
  @UseGuards(JwtAuthGuard)
  async getAttempts(
    @Param('activityId') activityId: string,
    @GetUser() user: User
  ) {
    const activity = await this.activityService.findById(activityId)

    const attempts = await this.attemptRepository.findMany({
      where: {
        studentId: user.id,
        activityId
      },
      orderBy: { attemptNo: 'desc' }
    })

    const currentAttempts = attempts.length
    const maxAttempts = activity.maxAttempts || Infinity
    const attemptsRemaining = Math.max(0, maxAttempts - currentAttempts)
    const canRetry = attemptsRemaining > 0

    return {
      currentAttempts,
      maxAttempts,
      attemptsRemaining,
      canRetry,
      attempts
    }
  }

  @Post(':activityId/attempts')
  @UseGuards(JwtAuthGuard)
  async createAttempt(
    @Param('activityId') activityId: string,
    @Body() dto: CreateAttemptDto,
    @GetUser() user: User
  ) {
    // Check if can attempt
    const { canRetry, currentAttempts } = await this.getAttempts(
      activityId,
      user
    )

    if (!canRetry) {
      throw new BadRequestException('Maximum attempts reached')
    }

    // Create new attempt
    const attempt = await this.attemptRepository.create({
      studentId: user.id,
      activityId,
      attemptNo: currentAttempts + 1,
      answers: dto.answers,
      score: dto.score,
      completed: dto.completed,
      finishedAt: dto.completed ? new Date() : null,
      timeSpent: dto.timeSpent
    })

    return attempt
  }
}
```

---

## ⭐⭐ **MEDIUM Priority**

### 6. Real-time Notifications (Socket.IO)
**Priority:** MEDIUM
**Effort:** 3-4 ngày

**Setup:**
```typescript
// apps/client-api/src/domains/notification/notification.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL }
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server

  private connectedUsers = new Map<string, string>() // userId -> socketId

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token
      const payload = this.jwtService.verify(token)

      const userId = payload.sub
      this.connectedUsers.set(userId, client.id)

      // Join user's personal room
      client.join(`user:${userId}`)

      console.log(`User ${userId} connected`)
    } catch (error) {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    // Remove from map
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId)
        console.log(`User ${userId} disconnected`)
        break
      }
    }
  }

  // Send notification to specific user
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data)
  }

  // Broadcast to all users
  broadcast(event: string, data: any) {
    this.server.emit(event, data)
  }
}
```

**Usage in Services:**
```typescript
// In notification.service.ts
export class NotificationService {
  constructor(
    private notificationGateway: NotificationGateway
  ) {}

  async create(data: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({ data })

    // Send real-time event
    this.notificationGateway.sendToUser(
      data.userId,
      'notification:new',
      notification
    )

    return notification
  }
}
```

---

### 7. User Settings API
**Priority:** LOW
**Effort:** 1-2 ngày

**Prisma Schema:**
```prisma
model UserSettings {
  id             String  @id @default(uuid())
  userId         String  @unique
  language       String  @default("en")
  theme          String  @default("light")
  emailNotifs    Boolean @default(true)
  pushNotifs     Boolean @default(true)
  soundEnabled   Boolean @default(true)
  autoplay       Boolean @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Controller:**
```typescript
@Controller('users/settings')
export class UserSettingsController {
  @Get()
  @UseGuards(JwtAuthGuard)
  async getSettings(@GetUser() user: User) {
    let settings = await this.settingsRepo.findByUserId(user.id)

    if (!settings) {
      // Create default settings
      settings = await this.settingsRepo.create({
        userId: user.id
      })
    }

    return settings
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async updateSettings(
    @GetUser() user: User,
    @Body() dto: UpdateSettingsDto
  ) {
    return this.settingsRepo.update(user.id, dto)
  }
}
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### Week 1-2: Foundation
- [ ] Podcast Repository (2-3 ngày)
- [ ] Forgot Password Email (2-3 ngày)

### Week 3-4: Core APIs
- [ ] Assignment APIs (3-4 ngày)
- [ ] Activity Attempts Tracking (2-3 ngày)
- [ ] Learner Notes API (2-3 ngày)

### Week 5-6: Advanced
- [ ] Real-time Socket.IO (3-4 ngày)
- [ ] User Settings API (1-2 ngày)

**Total: 5-6 weeks**

---

## 🔧 **DEPENDENCIES**

### Required Packages:
```bash
npm install nodemailer handlebars
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @nestjs/throttler
npm install --save-dev @types/nodemailer
```

### Environment Variables:
```env
# Add to .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
FRONTEND_URL=http://localhost:5173
```

---

**Document Owner:** Backend Team
**Status:** 🟢 Ready for Implementation

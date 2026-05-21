export const translations = {
  zh: {
    app_name: '绘忆',
    app_subtitle: 'AI 日记日历',
    // Auth
    login: '登录',
    register: '注册',
    logout: '退出',
    email: '邮箱',
    password: '密码',
    confirm_password: '确认密码',
    no_account: '还没有账号？',
    have_account: '已有账号？',
    login_now: '立即登录',
    register_now: '立即注册',
    email_placeholder: '请输入邮箱',
    password_placeholder: '请输入密码（至少6位）',
    confirm_placeholder: '请再次输入密码',
    password_mismatch: '两次密码不一致',
    // Home / Calendar
    today: '今天',
    calendar: '日历',
    create: '创作',
    no_entries: '今天还没有记录',
    tap_to_create: '点击下方按钮开始创作',
    // Input
    input_placeholder: '写下今天的一句话...',
    upload_photo: '上传照片',
    select_style: '选择风格',
    custom_style_placeholder: '输入自定义风格，如：油画风格、赛博朋克...',
    generating: '正在创作中...',
    generate: '开始创作',
    // Entry actions
    download: '下载',
    copy: '复制',
    delete: '删除',
    regenerate: '重新生成',
    share: '分享',
    // Diary note
    generate_diary: '生成今日日记',
    diary_keywords: '关键词（可选）',
    diary_keywords_placeholder: '例如：开心、咖啡、阳光...',
    generating_diary: '正在生成日记...',
    diary_note: '今日日记',
    no_diary: '还没有今日日记',
    need_3_images: '生成3张以上图片后，可以生成今日日记',
    // Day view
    images_count: (n: number) => `${n} 张图片`,
    // Confirm
    confirm_delete: '确认删除这张图片？',
    confirm: '确认',
    cancel: '取消',
    // Errors
    error_generate: '生成失败，请重试',
    error_upload: '上传失败，请重试',
    error_login: '邮箱或密码错误',
    error_register: '注册失败，请重试',
    error_email_exists: '该邮箱已注册',
    // Success
    copied: '已复制',
    deleted: '已删除',
    downloaded: '已下载',
    // Styles
    style_cartoon: '卡通',
    style_anime: '日系动漫',
    style_pixel: '像素艺术',
    style_sketch: '素描',
    style_watercolor: '水彩',
    style_custom: '自定义',
    // Months
    months: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
    weekdays: ['日','一','二','三','四','五','六'],
  },
  en: {
    app_name: 'PicDiary',
    app_subtitle: 'AI Diary Calendar',
    // Auth
    login: 'Sign In',
    register: 'Sign Up',
    logout: 'Sign Out',
    email: 'Email',
    password: 'Password',
    confirm_password: 'Confirm Password',
    no_account: "Don't have an account?",
    have_account: 'Already have an account?',
    login_now: 'Sign In',
    register_now: 'Sign Up',
    email_placeholder: 'Enter your email',
    password_placeholder: 'Enter password (min 6 chars)',
    confirm_placeholder: 'Confirm your password',
    password_mismatch: 'Passwords do not match',
    // Home / Calendar
    today: 'Today',
    calendar: 'Calendar',
    create: 'Create',
    no_entries: 'No entries today',
    tap_to_create: 'Tap the button below to start',
    // Input
    input_placeholder: 'Write something about today...',
    upload_photo: 'Upload Photo',
    select_style: 'Select Style',
    custom_style_placeholder: 'E.g. oil painting, cyberpunk...',
    generating: 'Creating...',
    generate: 'Create',
    // Entry actions
    download: 'Download',
    copy: 'Copy',
    delete: 'Delete',
    regenerate: 'Regenerate',
    share: 'Share',
    // Diary note
    generate_diary: "Generate Today's Diary",
    diary_keywords: 'Keywords (optional)',
    diary_keywords_placeholder: 'E.g. happy, coffee, sunshine...',
    generating_diary: 'Generating diary...',
    diary_note: "Today's Diary",
    no_diary: 'No diary yet',
    need_3_images: 'Generate 3+ images to unlock diary generation',
    // Day view
    images_count: (n: number) => `${n} image${n !== 1 ? 's' : ''}`,
    // Confirm
    confirm_delete: 'Delete this image?',
    confirm: 'Confirm',
    cancel: 'Cancel',
    // Errors
    error_generate: 'Generation failed, please retry',
    error_upload: 'Upload failed, please retry',
    error_login: 'Invalid email or password',
    error_register: 'Registration failed',
    error_email_exists: 'Email already registered',
    // Success
    copied: 'Copied!',
    deleted: 'Deleted',
    downloaded: 'Downloaded',
    // Styles
    style_cartoon: 'Cartoon',
    style_anime: 'Anime',
    style_pixel: 'Pixel Art',
    style_sketch: 'Sketch',
    style_watercolor: 'Watercolor',
    style_custom: 'Custom',
    // Months
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    weekdays: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  }
}

export type TranslationKey = keyof typeof translations.zh

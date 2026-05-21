const DEFAULT_EVENT_YEAR = 2026

const TARGET_GROUPS = {
  gift: ['mom', 'dad', 'grandma', 'grandpa', 'teacher', 'nurse', 'coworker', 'best friend', 'family'],
  family: ['mom', 'dad', 'kids', 'grandma', 'grandpa', 'family matching', 'couples', 'baby', 'pet owner'],
  school: ['teacher', 'kindergarten teacher', 'school nurse', 'librarian', 'principal', 'student', 'mom'],
  party: ['hostess', 'couples', 'best friend', 'coworker', 'party crew', 'family matching', 'kids party'],
  pet: ['dog mom', 'dog dad', 'cat mom', 'cat dad', 'pet owner', 'rescue mom', 'pet lover'],
  patriotic: ['veteran', 'military family', 'dad', 'mom', 'grandpa', 'teacher', 'family matching'],
  awareness: ['support squad', 'survivor', 'teacher', 'nurse', 'mom', 'friend', 'family'],
}

const DEFAULT_DESIGN_ANGLES = ['clean typography', 'simple icon plus text', 'giftable phrase layout', 'retro badge style']

const AUTO_DISCOVERY_SEGMENTS = {
  recipients: [
    'mom',
    'dad',
    'grandma',
    'grandpa',
    'teacher',
    'nurse',
    'coworker',
    'best friend',
    'bride',
    'groom',
    'maid of honor',
    'dog mom',
    'dog dad',
    'cat mom',
    'cat dad',
    'book lover',
    'coffee lover',
    'plant lover',
  ],
  situations: [
    'new mom',
    'new dad',
    'mom to be',
    'dad to be',
    'first time mom',
    'first time dad',
    'retirement',
    'graduation',
    'first day of school',
    'family reunion',
    'girls trip',
    'bachelorette',
    'baby shower',
    'pregnancy announcement',
    'housewarming',
    'bridal shower',
  ],
  hobbiesAndWork: [
    'book lover',
    'pickleball',
    'camping',
    'fishing',
    'gardening',
    'plant lover',
    'coffee lover',
    'teacher',
    'nurse',
    'librarian',
    'firefighter',
    'realtor',
    'barber',
    'accountant',
    'mechanic',
    'coach',
  ],
  styles: [
    'funny',
    'sarcastic',
    'retro',
    'vintage',
    'embroidered',
    'western',
    'minimalist',
    'boho',
    'cute',
    'matching',
    'personalized',
    'custom',
  ],
}

const PRODUCT_DISCOVERY_SEGMENTS = {
  shirt: ['funny', 'embroidered', 'retro', 'vintage', 'western', 'matching'],
  sweatshirt: ['embroidered', 'cozy', 'teacher', 'nurse', 'retro'],
  mug: ['funny', 'personalized', 'teacher', 'nurse', 'coffee lover'],
  tote: ['book lover', 'teacher', 'library', 'bridesmaid', 'market'],
  sticker: ['teacher', 'book lover', 'planner', 'water bottle', 'laptop'],
}

const AUTO_DISCOVERY_INTENTS = [
  'funny',
  'personalized',
  'custom',
  'matching',
  'retro',
  'vintage',
  'embroidered',
  'appreciation',
]

const VISUAL_SIGNAL_LIBRARY = [
  {
    phrases: ['dog', 'dog dad', 'dog mom', 'pet owner', 'pet lover', 'rescue'],
    main: ['dog face', 'paw print', 'dog silhouette'],
    supporting: ['bone icon', 'leash curve', 'small heart'],
    mood: ['playful', 'loyal', 'warm'],
    avoid: ['copyrighted dog characters', 'real brand mascots'],
  },
  {
    phrases: ['cat', 'cat dad', 'cat mom'],
    main: ['cat face', 'cat silhouette', 'whiskers'],
    supporting: ['paw print', 'yarn ball', 'small moon'],
    mood: ['cute', 'cozy', 'slightly funny'],
    avoid: ['copyrighted cat characters'],
  },
  {
    phrases: ['book', 'book lover', 'library', 'librarian', 'reading'],
    main: ['stack of books', 'open book', 'library card'],
    supporting: ['coffee cup', 'bookmark', 'reading glasses', 'small flowers'],
    mood: ['cozy', 'quiet', 'clever'],
    avoid: ['specific book covers', 'publisher logos'],
  },
  {
    phrases: ['coffee', 'latte', 'espresso', 'caffeine'],
    main: ['coffee mug', 'coffee cup', 'steam lines'],
    supporting: ['coffee beans', 'small heart', 'morning sun'],
    mood: ['cozy', 'daily ritual', 'warm'],
    avoid: ['coffee chain logos'],
  },
  {
    phrases: ['flower', 'floral', 'garden', 'gardening', 'plant', 'plant lover'],
    main: ['wildflower bouquet', 'potted plant', 'leaf sprig'],
    supporting: ['sun rays', 'watering can', 'butterfly accent'],
    mood: ['soft', 'fresh', 'botanical'],
    avoid: ['overly detailed photo flowers'],
  },
  {
    phrases: ['teacher', 'school', 'student', 'kindergarten', 'preschool'],
    main: ['pencil', 'apple icon', 'book stack'],
    supporting: ['stars', 'ruler line', 'notebook doodles'],
    mood: ['friendly', 'classroom', 'appreciation'],
    avoid: ['school district logos'],
  },
  {
    phrases: ['nurse', 'doctor', 'medical', 'nicu', 'er nurse'],
    main: ['stethoscope', 'medical cross', 'heartbeat line'],
    supporting: ['small heart', 'badge shape', 'sparkle accent'],
    mood: ['caring', 'clean', 'appreciation'],
    avoid: ['hospital logos', 'official medical emblems'],
  },
  {
    phrases: ['dad', 'father', 'fathers day', 'papa', 'grandpa', 'bonus dad'],
    main: ['bold dad typography', 'mustache icon', 'simple badge'],
    supporting: ['tools', 'grill icon', 'cap silhouette', 'small heart'],
    mood: ['giftable', 'proud', 'funny'],
    avoid: ['sports team logos', 'beer brand logos'],
  },
  {
    phrases: ['mom', 'mother', 'mothers day', 'mama', 'grandma', 'bonus mom'],
    main: ['bold mama typography', 'heart icon', 'floral frame'],
    supporting: ['sparkles', 'small bow', 'leaf accent'],
    mood: ['warm', 'giftable', 'sweet'],
    avoid: ['luxury brand marks'],
  },
  {
    phrases: ['bride', 'groom', 'wedding', 'bridesmaid', 'maid of honor'],
    main: ['ring icon', 'champagne glass', 'bow ribbon'],
    supporting: ['sparkles', 'heart line', 'small flower'],
    mood: ['celebratory', 'clean', 'party'],
    avoid: ['venue logos', 'designer brand marks'],
  },
  {
    phrases: ['graduation', 'graduate', 'senior class', 'college'],
    main: ['graduation cap', 'diploma scroll', 'star badge'],
    supporting: ['confetti', 'year text if requested', 'laurel'],
    mood: ['proud', 'milestone', 'bold'],
    avoid: ['school logos', 'official seals'],
  },
  {
    phrases: ['camping', 'camper', 'mountain', 'hiking', 'nature'],
    main: ['mountain silhouette', 'campfire', 'tent icon'],
    supporting: ['pine trees', 'stars', 'sunset lines'],
    mood: ['outdoor', 'retro', 'adventure'],
    avoid: ['national park official logos'],
  },
  {
    phrases: ['fishing', 'fish', 'lake'],
    main: ['fish silhouette', 'fishing rod', 'hook line'],
    supporting: ['water ripple', 'sunset', 'small badge'],
    mood: ['outdoor', 'relaxed', 'dad humor'],
    avoid: ['brand tackle logos'],
  },
  {
    phrases: ['pickleball', 'tennis'],
    main: ['pickleball paddle', 'ball icon', 'court line'],
    supporting: ['motion lines', 'small star', 'retro sun'],
    mood: ['sporty', 'fun', 'active'],
    avoid: ['league logos'],
  },
  {
    phrases: ['western', 'cowgirl', 'cowboy', 'rodeo'],
    main: ['cowboy boot', 'cowboy hat', 'desert sun'],
    supporting: ['cactus', 'horseshoe', 'rope border'],
    mood: ['western', 'vintage', 'bold'],
    avoid: ['western brand logos'],
  },
  {
    phrases: ['pumpkin', 'halloween', 'spooky', 'fall', 'autumn', 'summerween'],
    main: ['pumpkin', 'ghost icon', 'bat silhouette'],
    supporting: ['stars', 'moon', 'leaf accents'],
    mood: ['cute spooky', 'seasonal', 'playful'],
    avoid: ['movie monsters', 'licensed horror characters'],
  },
  {
    phrases: ['christmas', 'holiday', 'santa', 'xmas'],
    main: ['christmas tree', 'gift box', 'ornament'],
    supporting: ['snowflakes', 'bow ribbon', 'sparkles'],
    mood: ['festive', 'cozy', 'family'],
    avoid: ['licensed holiday characters'],
  },
  {
    phrases: ['summer', 'beach', 'vacation', 'summerween'],
    main: ['sun icon', 'wave line', 'beach umbrella'],
    supporting: ['palm leaf', 'sunglasses', 'small shell'],
    mood: ['bright', 'playful', 'seasonal'],
    avoid: ['travel brand logos'],
  },
  {
    phrases: ['patriotic', 'america', 'fourth of july', 'independence day', 'veteran'],
    main: ['star badge', 'flag-inspired stripes', 'eagle silhouette'],
    supporting: ['fireworks', 'laurel', 'simple ribbon'],
    mood: ['bold', 'classic', 'proud'],
    avoid: ['official military seals', 'government insignia'],
  },
  {
    phrases: ['firefighter', 'fireman'],
    main: ['fire helmet', 'flame icon', 'axe silhouette'],
    supporting: ['badge shape', 'hose curve', 'small stars'],
    mood: ['heroic', 'bold', 'appreciation'],
    avoid: ['official department logos'],
  },
  {
    phrases: ['realtor', 'real estate'],
    main: ['house outline', 'key icon', 'sold sign shape'],
    supporting: ['roof line', 'small heart', 'sparkle accent'],
    mood: ['clean', 'professional', 'giftable'],
    avoid: ['brokerage logos'],
  },
]

const CATEGORY_VISUAL_GUIDANCE = {
  shirt: {
    main: ['center chest graphic'],
    supporting: ['transparent background'],
    productNote: 'shirt-ready print, readable from a distance, 2-4 strong colors',
  },
  sweatshirt: {
    main: ['cozy center chest graphic'],
    supporting: ['soft vintage texture'],
    productNote: 'sweatshirt-ready print, slightly bolder shapes, cozy color palette',
  },
  mug: {
    main: ['compact mug graphic'],
    supporting: ['small side accents'],
    productNote: 'mug-ready design, compact composition, readable at small size',
  },
  tote: {
    main: ['vertical tote layout'],
    supporting: ['simple line art accents'],
    productNote: 'tote-ready design, clear vertical composition, simple printable lines',
  },
  sticker: {
    main: ['die-cut sticker icon'],
    supporting: ['thick outline'],
    productNote: 'sticker-ready design, bold silhouette, simple cut-friendly outline',
  },
}

function marketEvent(config) {
  return {
    defaultYear: DEFAULT_EVENT_YEAR,
    displayTerm: config.label,
    targets: TARGET_GROUPS.gift,
    intents: [`${config.searchTerm} gift`, `${config.searchTerm} shirt`, `${config.searchTerm} party`],
    designAngles: DEFAULT_DESIGN_ANGLES,
    ...config,
  }
}

export const MARKET_EVENTS = [
  marketEvent({
    id: 'auto-discovery',
    month: 0,
    label: 'Auto Discovery',
    jpLabel: '自動探索',
    searchTerm: '',
    displayTerm: 'Auto Discovery',
    targets: AUTO_DISCOVERY_SEGMENTS.recipients,
    intents: [
      'funny',
      'personalized',
      'custom',
      'matching',
      'retro',
      'vintage',
    ],
    designAngles: ['clear typography', 'niche phrase layout', 'simple icon plus text', 'giftable product design'],
  }),
  marketEvent({
    id: 'new-years-day',
    month: 1,
    label: "New Year's Day",
    jpLabel: '元日',
    searchTerm: 'new years day',
    targets: ['party host', 'family matching', 'couples', 'best friend', 'coworker', 'teacher', 'mom'],
    intents: ['new year gift', 'new year party', 'new year crew', 'new year {year}', 'fresh start'],
    designAngles: ['sparkle typography', 'minimal year badge', 'party phrase layout', 'black and gold accent'],
  }),
  marketEvent({
    id: 'mlk-day',
    month: 1,
    label: 'MLK Day',
    jpLabel: 'キング牧師記念日',
    searchTerm: 'mlk day',
    targets: ['teacher', 'student', 'school staff', 'community group', 'family'],
    intents: ['mlk day shirt', 'dream quote', 'peace equality', 'civil rights'],
    designAngles: ['respectful typography', 'school event layout', 'minimal quote design', 'heritage colors'],
  }),
  marketEvent({
    id: 'lunar-new-year',
    month: 1,
    label: 'Lunar New Year',
    jpLabel: '旧正月',
    searchTerm: 'lunar new year',
    targets: ['family', 'kids', 'teacher', 'party host', 'coworker', 'mom'],
    intents: ['lunar new year gift', 'year of the horse', 'lunar new year party', 'new year family'],
    designAngles: ['festive red accent', 'zodiac animal motif', 'clean cultural typography', 'family celebration'],
  }),
  marketEvent({
    id: 'valentines-day',
    month: 2,
    label: "Valentine's Day",
    jpLabel: 'バレンタイン',
    searchTerm: 'valentines day',
    targets: ['wife', 'husband', 'teacher', 'book lover', 'best friend', 'couples', 'single humor', 'mom'],
    intents: ['valentines gift', 'matching valentines', 'galentines', 'love shirt', 'heart day'],
    designAngles: ['simple heart motif', 'playful type lockup', 'soft pink accent', 'clean gift wording'],
  }),
  marketEvent({
    id: 'galentines-day',
    month: 2,
    label: "Galentine's Day",
    jpLabel: 'ガレンタイン',
    searchTerm: 'galentines day',
    targets: ['best friend', 'bridesmaid', 'coworker', 'book club', 'mom friend', 'sister'],
    intents: ['galentines gift', 'girls night', 'bestie gift', 'friendship shirt', 'galentines party'],
    designAngles: ['playful friendship type', 'heart icon cluster', 'pink and red accent', 'party wording'],
  }),
  marketEvent({
    id: 'black-history-month',
    month: 2,
    label: 'Black History Month',
    jpLabel: 'ブラックヒストリーマンス',
    searchTerm: 'black history month',
    targets: ['teacher', 'student', 'school staff', 'mom', 'community group'],
    intents: ['black history month shirt', 'school celebration', 'black pride', 'history teacher'],
    designAngles: ['bold heritage typography', 'classroom friendly layout', 'respectful statement design', 'warm accent colors'],
  }),
  marketEvent({
    id: 'big-game-party',
    month: 2,
    label: 'Big Game Party',
    jpLabel: 'ビッグゲーム',
    searchTerm: 'big game party',
    targets: ['party host', 'dad', 'mom', 'football mom', 'tailgate crew', 'coworker'],
    intents: ['big game party shirt', 'football party', 'tailgate shirt', 'game day snack'],
    designAngles: ['sports party typography', 'snack icon layout', 'tailgate badge', 'green field accent'],
  }),
  marketEvent({
    id: 'st-patricks-day',
    month: 3,
    label: "St. Patrick's Day",
    jpLabel: 'セントパトリックデー',
    searchTerm: 'st patricks day',
    targets: ['teacher', 'nurse', 'mom', 'dad', 'party crew', 'coworker', 'kids'],
    intents: ['st patricks day gift', 'lucky shirt', 'irish party', 'shamrock shirt', 'pinch proof'],
    designAngles: ['green accent type', 'shamrock icon', 'pub style badge', 'funny party phrase'],
  }),
  marketEvent({
    id: 'mardi-gras',
    month: 3,
    label: 'Mardi Gras',
    jpLabel: 'マルディグラ',
    searchTerm: 'mardi gras',
    targets: ['party crew', 'teacher', 'mom', 'coworker', 'best friend', 'travel group'],
    intents: ['mardi gras party', 'mardi gras shirt', 'beads mask', 'new orleans trip'],
    designAngles: ['purple green gold palette', 'mask icon', 'party typography', 'travel souvenir feel'],
  }),
  marketEvent({
    id: 'womens-history-month',
    month: 3,
    label: "Women's History Month",
    jpLabel: '女性史月間',
    searchTerm: 'womens history month',
    targets: ['teacher', 'student', 'mom', 'nurse', 'book lover', 'coworker'],
    intents: ['womens history month shirt', 'women empowerment', 'classroom shirt', 'girl power'],
    designAngles: ['bold statement type', 'classroom friendly design', 'minimal icon accent', 'empowerment wording'],
  }),
  marketEvent({
    id: 'spring-break',
    month: 3,
    label: 'Spring Break',
    jpLabel: '春休み',
    searchTerm: 'spring break',
    targets: ['teacher', 'student', 'mom', 'travel group', 'beach trip', 'best friend'],
    intents: ['spring break trip', 'beach vacation', 'teacher spring break', 'family vacation'],
    designAngles: ['sunny travel layout', 'retro beach type', 'simple vacation badge', 'bright accent colors'],
  }),
  marketEvent({
    id: 'easter',
    month: 4,
    label: 'Easter',
    jpLabel: 'イースター',
    searchTerm: 'easter',
    targets: ['mom', 'kids', 'teacher', 'family matching', 'grandma', 'church group', 'pet owner'],
    intents: ['easter gift', 'easter egg hunt', 'easter bunny', 'family easter', 'teacher easter'],
    designAngles: ['soft pastel type', 'bunny icon', 'egg hunt layout', 'family matching wording'],
  }),
  marketEvent({
    id: 'earth-day',
    month: 4,
    label: 'Earth Day',
    jpLabel: 'アースデイ',
    searchTerm: 'earth day',
    targets: ['teacher', 'student', 'nature lover', 'plant lover', 'mom', 'school club'],
    intents: ['earth day shirt', 'plant trees', 'save the planet', 'nature teacher', 'eco gift'],
    designAngles: ['nature inspired icon', 'clean eco typography', 'green accent palette', 'school event layout'],
  }),
  marketEvent({
    id: 'national-pet-day',
    month: 4,
    label: 'National Pet Day',
    jpLabel: 'ナショナルペットデー',
    searchTerm: 'national pet day',
    targets: TARGET_GROUPS.pet,
    intents: ['national pet day gift', 'dog mom gift', 'dog dad gift', 'cat mom gift', 'rescue pet'],
    designAngles: ['paw icon plus text', 'pet portrait wording', 'funny owner phrase', 'simple badge design'],
  }),
  marketEvent({
    id: 'administrative-professionals-day',
    month: 4,
    label: 'Administrative Professionals Day',
    jpLabel: '事務職感謝デー',
    searchTerm: 'administrative professionals day',
    targets: ['admin assistant', 'office manager', 'coworker', 'boss', 'school secretary', 'medical office'],
    intents: ['admin gift', 'office gift', 'secretary gift', 'administrative assistant gift'],
    designAngles: ['office humor typography', 'clean desk icon', 'appreciation gift wording', 'minimal professional layout'],
  }),
  marketEvent({
    id: 'mothers-day',
    month: 5,
    label: "Mother's Day",
    jpLabel: '母の日',
    searchTerm: 'mothers day',
    targets: ['new mom', 'first time mom', 'mama', 'grandma', 'bonus mom', 'dog mom', 'boy mom', 'girl mom', 'mom to be'],
    intents: ['first mothers day', 'mama est {year}', 'mothers day gift', 'from daughter', 'from son', 'mom life'],
    designAngles: ['soft retro lettering', 'floral accent', 'clean script plus block text', 'warm gift wording'],
  }),
  marketEvent({
    id: 'teacher-appreciation-week',
    month: 5,
    label: 'Teacher Appreciation Week',
    jpLabel: '先生感謝週間',
    searchTerm: 'teacher appreciation week',
    targets: ['teacher', 'kindergarten teacher', 'preschool teacher', 'school nurse', 'librarian', 'principal'],
    intents: ['teacher appreciation gift', 'teacher gift', 'end of school gift', 'classroom gift', 'teacher life'],
    designAngles: ['school supply icon', 'warm thank-you wording', 'classroom badge', 'playful teacher typography'],
  }),
  marketEvent({
    id: 'nurses-week',
    month: 5,
    label: 'Nurses Week',
    jpLabel: '看護師週間',
    searchTerm: 'nurses week',
    targets: ['nurse', 'labor delivery nurse', 'nicu nurse', 'er nurse', 'nursing student', 'doctor office'],
    intents: ['nurse appreciation gift', 'nurses week gift', 'nurse life', 'healthcare worker gift'],
    designAngles: ['medical icon plus text', 'scrubs friendly layout', 'thank-you phrase', 'clean badge style'],
  }),
  marketEvent({
    id: 'graduation',
    month: 5,
    label: 'Graduation',
    jpLabel: '卒業',
    searchTerm: 'graduation',
    targets: ['graduate', 'mom of graduate', 'dad of graduate', 'teacher', 'senior class', 'nursing graduate'],
    intents: ['graduation gift', 'class of {year}', 'senior {year}', 'grad party', 'proud mom'],
    designAngles: ['class year typography', 'cap icon', 'party badge layout', 'school color friendly design'],
  }),
  marketEvent({
    id: 'memorial-day',
    month: 5,
    label: 'Memorial Day',
    jpLabel: 'メモリアルデー',
    searchTerm: 'memorial day',
    targets: TARGET_GROUPS.patriotic,
    intents: ['memorial day shirt', 'memorial day weekend', 'patriotic shirt', 'military family gift'],
    designAngles: ['patriotic color accent', 'respectful badge design', 'weekend party phrase', 'minimal star icon'],
  }),
  marketEvent({
    id: 'cinco-de-mayo',
    month: 5,
    label: 'Cinco de Mayo',
    jpLabel: 'シンコデマヨ',
    searchTerm: 'cinco de mayo',
    targets: ['party host', 'teacher', 'mom', 'best friend', 'coworker', 'taco lover'],
    intents: ['cinco de mayo party', 'taco shirt', 'fiesta shirt', 'margarita party'],
    designAngles: ['fiesta typography', 'taco icon', 'bright accent layout', 'party phrase design'],
  }),
  marketEvent({
    id: 'fathers-day',
    month: 6,
    label: "Father's Day",
    jpLabel: '父の日',
    searchTerm: 'fathers day',
    targets: ['new dad', 'first time dad', 'dog dad', 'girl dad', 'grandpa', 'bonus dad', 'dad to be', 'papa', 'husband dad'],
    intents: ['first fathers day', 'dad est {year}', 'fathers day gift', 'from daughter', 'from son', 'dad life'],
    designAngles: ['retro typography', 'simple badge layout', 'small icon plus bold text', 'giftable family wording'],
  }),
  marketEvent({
    id: 'pride-month',
    month: 6,
    label: 'Pride Month',
    jpLabel: 'プライド月間',
    searchTerm: 'pride month',
    targets: ['teacher', 'ally', 'mom', 'dad', 'couples', 'best friend', 'community group'],
    intents: ['pride month shirt', 'pride gift', 'love is love', 'ally shirt', 'rainbow shirt'],
    designAngles: ['rainbow accent', 'bold statement typography', 'community event layout', 'minimal pride icon'],
  }),
  marketEvent({
    id: 'juneteenth',
    month: 6,
    label: 'Juneteenth',
    jpLabel: 'ジューンティーンス',
    searchTerm: 'juneteenth',
    targets: ['teacher', 'student', 'family', 'community group', 'mom', 'dad'],
    intents: ['juneteenth shirt', 'freedom day', 'juneteenth celebration', 'black history'],
    designAngles: ['respectful heritage palette', 'freedom day typography', 'community celebration layout', 'minimal star accent'],
  }),
  marketEvent({
    id: 'wedding-season',
    month: 6,
    label: 'Wedding Season',
    jpLabel: '結婚式シーズン',
    searchTerm: 'wedding season',
    targets: ['bride', 'groom', 'bridesmaid', 'maid of honor', 'mother of bride', 'wedding guest'],
    intents: ['bridal party gift', 'wedding party shirt', 'bachelorette gift', 'custom wedding gift'],
    designAngles: ['elegant typography', 'minimal script accent', 'bridal party wording', 'custom name layout'],
  }),
  marketEvent({
    id: 'canada-day',
    month: 7,
    label: 'Canada Day',
    jpLabel: 'カナダデー',
    searchTerm: 'canada day',
    targets: ['family matching', 'mom', 'dad', 'teacher', 'party crew', 'camper'],
    intents: ['canada day shirt', 'canada day party', 'canadian gift', 'maple leaf shirt'],
    designAngles: ['maple leaf icon', 'red and white accent', 'party badge layout', 'simple patriotic type'],
  }),
  marketEvent({
    id: 'independence-day',
    month: 7,
    label: 'Independence Day',
    jpLabel: '独立記念日',
    searchTerm: '4th of july',
    displayTerm: '4th of July',
    targets: ['family matching', 'mom', 'dad', 'teacher', 'party crew', 'baby', 'dog mom'],
    intents: ['4th of july shirt', 'fourth of july party', 'patriotic shirt', 'bbq party', 'fireworks shirt'],
    designAngles: ['red white blue typography', 'fireworks icon', 'bbq party phrase', 'family matching layout'],
  }),
  marketEvent({
    id: 'summer-camp',
    month: 7,
    label: 'Summer Camp',
    jpLabel: 'サマーキャンプ',
    searchTerm: 'summer camp',
    targets: ['camp counselor', 'teacher', 'kids', 'mom', 'camper', 'youth group'],
    intents: ['summer camp shirt', 'camp counselor gift', 'camp crew', 'family camping'],
    designAngles: ['camp badge icon', 'outdoor retro type', 'sun and tent motif', 'group shirt layout'],
  }),
  marketEvent({
    id: 'back-to-school',
    month: 8,
    label: 'Back To School',
    jpLabel: 'バック・トゥ・スクール',
    searchTerm: 'back to school',
    targets: TARGET_GROUPS.school,
    intents: ['teacher shirt', 'first day of school', 'school staff', 'classroom gift', 'teacher life'],
    designAngles: ['school supply icon', 'bold classroom typography', 'retro academic palette', 'stacked phrase layout'],
  }),
  marketEvent({
    id: 'college-move-in',
    month: 8,
    label: 'College Move In',
    jpLabel: '大学入学準備',
    searchTerm: 'college move in',
    targets: ['college mom', 'college dad', 'freshman', 'roommate', 'student', 'dorm life'],
    intents: ['college move in gift', 'freshman year', 'dorm gift', 'college mom shirt'],
    designAngles: ['campus badge layout', 'dorm life phrase', 'simple collegiate type', 'custom school color friendly'],
  }),
  marketEvent({
    id: 'labor-day',
    month: 9,
    label: 'Labor Day',
    jpLabel: 'レイバーデー',
    searchTerm: 'labor day',
    targets: ['teacher', 'nurse', 'worker', 'dad', 'mom', 'party host', 'bbq crew'],
    intents: ['labor day weekend', 'labor day party', 'bbq shirt', 'long weekend'],
    designAngles: ['weekend party typography', 'bbq icon', 'simple worker badge', 'summer closeout palette'],
  }),
  marketEvent({
    id: 'grandparents-day',
    month: 9,
    label: "Grandparents Day",
    jpLabel: '祖父母の日',
    searchTerm: 'grandparents day',
    targets: ['grandma', 'grandpa', 'new grandma', 'new grandpa', 'nana', 'papa', 'kids'],
    intents: ['grandparents day gift', 'grandma gift', 'grandpa gift', 'from grandkids', 'est {year}'],
    designAngles: ['warm family typography', 'grandkids wording', 'simple heart icon', 'custom names layout'],
  }),
  marketEvent({
    id: 'fall-season',
    month: 9,
    label: 'Fall Season',
    jpLabel: '秋シーズン',
    searchTerm: 'fall season',
    targets: ['teacher', 'mom', 'book lover', 'coffee lover', 'pumpkin lover', 'nurse'],
    intents: ['fall shirt', 'pumpkin season', 'fall vibes', 'cozy season', 'coffee and books'],
    designAngles: ['cozy retro type', 'pumpkin icon', 'warm autumn palette', 'book and coffee layout'],
  }),
  marketEvent({
    id: 'halloween',
    month: 10,
    label: 'Halloween',
    jpLabel: 'ハロウィン',
    searchTerm: 'halloween',
    targets: ['teacher', 'nurse', 'book lover', 'mom', 'couples', 'kids party', 'office party', 'pet owner'],
    intents: ['spooky season', 'halloween party', 'trick or treat', 'matching halloween', 'halloween gift'],
    designAngles: ['vintage spooky lettering', 'small seasonal icon', 'campy retro composition', 'black and cream print palette'],
  }),
  marketEvent({
    id: 'breast-cancer-awareness',
    month: 10,
    label: 'Breast Cancer Awareness',
    jpLabel: '乳がん啓発月間',
    searchTerm: 'breast cancer awareness',
    targets: TARGET_GROUPS.awareness,
    intents: ['breast cancer awareness shirt', 'pink ribbon', 'support squad', 'survivor gift', 'walk team'],
    designAngles: ['pink ribbon accent', 'support team wording', 'respectful typography', 'fundraiser friendly layout'],
  }),
  marketEvent({
    id: 'canadian-thanksgiving',
    month: 10,
    label: 'Canadian Thanksgiving',
    jpLabel: 'カナダ感謝祭',
    searchTerm: 'canadian thanksgiving',
    targets: ['family matching', 'mom', 'dad', 'grandma', 'hostess', 'teacher'],
    intents: ['thanksgiving gift', 'thanksgiving dinner', 'family thanksgiving', 'hostess gift'],
    designAngles: ['fall harvest icon', 'family dinner wording', 'warm autumn palette', 'simple thankful type'],
  }),
  marketEvent({
    id: 'veterans-day',
    month: 11,
    label: "Veterans Day",
    jpLabel: '退役軍人の日',
    searchTerm: 'veterans day',
    targets: TARGET_GROUPS.patriotic,
    intents: ['veterans day shirt', 'veteran gift', 'military family', 'proud veteran', 'thank you veteran'],
    designAngles: ['respectful patriotic type', 'star icon', 'military family wording', 'minimal badge design'],
  }),
  marketEvent({
    id: 'thanksgiving',
    month: 11,
    label: 'Thanksgiving',
    jpLabel: '感謝祭',
    searchTerm: 'thanksgiving',
    targets: ['family matching', 'mom', 'dad', 'grandma', 'hostess', 'teacher', 'kids'],
    intents: ['thanksgiving gift', 'thanksgiving dinner', 'thankful shirt', 'turkey day', 'friendsgiving'],
    designAngles: ['fall harvest icon', 'family dinner wording', 'warm autumn palette', 'simple thankful type'],
  }),
  marketEvent({
    id: 'friendsgiving',
    month: 11,
    label: 'Friendsgiving',
    jpLabel: 'フレンズギビング',
    searchTerm: 'friendsgiving',
    targets: ['best friend', 'hostess', 'coworker', 'party crew', 'roommate', 'book club'],
    intents: ['friendsgiving shirt', 'friendsgiving party', 'hostess gift', 'thankful friends'],
    designAngles: ['party dinner typography', 'wine and pie icon', 'friendship wording', 'warm fall palette'],
  }),
  marketEvent({
    id: 'black-friday',
    month: 11,
    label: 'Black Friday',
    jpLabel: 'ブラックフライデー',
    searchTerm: 'black friday',
    targets: ['shop owner', 'boutique owner', 'coworker', 'deal hunter', 'small business owner'],
    intents: ['black friday sale', 'shopping crew', 'small business saturday', 'deal hunter'],
    designAngles: ['bold sale typography', 'shopping bag icon', 'black and white contrast', 'retail humor phrase'],
  }),
  marketEvent({
    id: 'christmas',
    month: 12,
    label: 'Christmas',
    jpLabel: 'クリスマス',
    searchTerm: 'christmas',
    targets: ['mom', 'dad', 'grandma', 'teacher', 'nurse', 'book lover', 'family matching', 'coworker', 'pet owner'],
    intents: ['christmas gift', 'family christmas', 'christmas party', 'holiday season', 'matching christmas'],
    designAngles: ['cozy retro type', 'giftable phrase layout', 'classic holiday colors', 'simple icon cluster'],
  }),
  marketEvent({
    id: 'hanukkah',
    month: 12,
    label: 'Hanukkah',
    jpLabel: 'ハヌカ',
    searchTerm: 'hanukkah',
    targets: ['family', 'kids', 'teacher', 'mom', 'dad', 'hostess', 'grandma'],
    intents: ['hanukkah gift', 'hanukkah party', 'festival of lights', 'family hanukkah'],
    designAngles: ['blue and silver accent', 'lights motif', 'family celebration wording', 'clean holiday type'],
  }),
  marketEvent({
    id: 'holiday-party',
    month: 12,
    label: 'Holiday Party',
    jpLabel: 'ホリデーパーティー',
    searchTerm: 'holiday party',
    targets: ['coworker', 'office party', 'teacher', 'nurse', 'hostess', 'best friend', 'family matching'],
    intents: ['holiday party shirt', 'office holiday party', 'ugly sweater party', 'hostess gift'],
    designAngles: ['party typography', 'gift icon cluster', 'office humor wording', 'classic holiday accent'],
  }),
  marketEvent({
    id: 'new-years-eve',
    month: 12,
    label: "New Year's Eve",
    jpLabel: '大晦日',
    searchTerm: 'new years eve',
    targets: ['party host', 'couples', 'best friend', 'coworker', 'family matching', 'bride'],
    intents: ['new years eve party', 'nye shirt', 'party crew', 'midnight kiss', 'new year {year}'],
    designAngles: ['sparkle typography', 'party badge', 'black and gold accent', 'midnight phrase layout'],
  }),
]

export const PRODUCT_CATEGORIES = [
  { id: 'shirt', label: 'Shirt', searchTerm: 'shirt', tags: ['shirt', 'graphic tee', 'gift shirt'] },
  { id: 'sweatshirt', label: 'Sweatshirt', searchTerm: 'sweatshirt', tags: ['sweatshirt', 'cozy gift', 'crewneck'] },
  { id: 'mug', label: 'Mug', searchTerm: 'mug', tags: ['mug', 'coffee gift', 'cup'] },
  { id: 'tote', label: 'Tote Bag', searchTerm: 'tote bag', tags: ['tote bag', 'canvas tote', 'gift tote'] },
  { id: 'sticker', label: 'Sticker', searchTerm: 'sticker', tags: ['sticker', 'laptop sticker', 'planner sticker'] },
]

export const DEFAULT_RISK_TERMS = [
  'disney',
  'mickey',
  'marvel',
  'star wars',
  'harry potter',
  'pokemon',
  'barbie',
  'hello kitty',
  'grinch',
  'swiftie',
  'taylor swift',
  'super bowl',
  'nfl',
  'nba',
  'mlb',
  'olympics',
  'lego',
]

const GENERIC_WORDS = new Set([
  'shirt',
  'shirts',
  'tee',
  'tshirt',
  'tshirts',
  'sweatshirt',
  'sweatshirts',
  'hoodie',
  'mug',
  'tote',
  'bag',
  'gift',
  'gifts',
  'custom',
  'personalized',
  'vintage',
  'retro',
  'funny',
  'cute',
  'graphic',
  'unisex',
  'women',
  'men',
  'for',
  'and',
  'the',
  'with',
  'from',
  'day',
  'holiday',
  'season',
])

const DEFAULT_HINT_KEEP_WORDS = new Set([
  'day',
  'from',
  'first',
  'est',
  'to',
])

const FIELD_ALIASES = {
  keyword: ['keyword', 'search term', 'query', 'キーワード'],
  listingsAnalyzed: ['listings analyzed', 'listings', 'listing count', 'results', '競合数'],
  topMonthlySales: ['top monthly sales', 'monthly sales', 'sales', '月間販売数'],
  topRevenue: ['top revenue', 'revenue', 'monthly revenue', '売上', '収益'],
  averagePrice: ['average price', 'avg price', 'price', '平均価格'],
  listingAge: ['listing age', 'age', '公開期間', '掲載期間'],
  erankSearchVolume: ['erank search volume', 'erank search', 'search volume', 'search', 'avg searches', 'avg. searches', 'average searches', 'searches'],
  erankClicks: ['erank clicks', 'clicks', 'avg clicks', 'average clicks'],
  erankCtr: ['erank ctr', 'ctr', 'click through rate', 'click-through rate'],
  erankCompetition: ['erank competition', 'competition', 'etsy competition'],
  erankKeywordDifficulty: ['erank kd', 'kd', 'keyword difficulty', 'difficulty'],
  erankTrend: ['erank trend', 'trend', 'monthly trend'],
  notes: ['notes', 'note', 'memo', 'メモ'],
}

const BROAD_LISTING_FIELD_ALIASES = {
  title: ['title', 'product title', 'product name', 'listing title', 'name', '商品名', 'タイトル'],
  tags: ['tags', 'tag', 'etsy tags', 'tag words', 'タグ'],
  sales: ['sales', 'monthly sales', 'total sales', 'estimated sales', 'est sales', 'top monthly sales', '販売数', '月間販売数'],
  revenue: ['revenue', 'monthly revenue', 'estimated revenue', '売上', '収益'],
  notes: ['notes', 'note', 'memo', 'メモ'],
}

function unique(values) {
  const seen = new Set()
  return values.filter((value) => {
    const key = normalizePhrase(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizePhrase(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(value) {
  return normalizePhrase(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => (word.length <= 3 ? word : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join(' ')
}

function fillTemplate(value, year) {
  if (String(value).includes('{year}') && !year) return ''
  return String(value).replace(/\{year\}/g, String(year))
}

function parseOptionalYear(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function splitSeedText(value) {
  return String(value ?? '')
    .split(/[\n,;]+/)
    .map((item) => normalizePhrase(item))
    .filter((item) => item.length >= 2)
}

function autoDiscoveryTerms(category, event) {
  return unique([
    ...(event.targets ?? []),
    ...AUTO_DISCOVERY_SEGMENTS.recipients,
    ...AUTO_DISCOVERY_SEGMENTS.situations,
    ...AUTO_DISCOVERY_SEGMENTS.hobbiesAndWork,
    ...AUTO_DISCOVERY_SEGMENTS.styles,
    ...(PRODUCT_DISCOVERY_SEGMENTS[category.id] ?? []),
  ])
    .map((term) => normalizePhrase(term))
    .filter(Boolean)
}

function autoDiscoveryIntents() {
  return unique(AUTO_DISCOVERY_INTENTS)
}

function buildCustomMarketEvent(value) {
  const searchTerm = normalizePhrase(value)
  const label = String(value ?? '').trim()
  const displayLabel = label || titleCase(searchTerm) || 'Custom Event'

  return marketEvent({
    id: 'custom-event',
    month: 0,
    label: displayLabel,
    jpLabel: displayLabel,
    searchTerm,
    displayTerm: displayLabel,
    targets: TARGET_GROUPS.gift,
    intents: [
      `${searchTerm} gift`,
      `${searchTerm} shirt`,
      `${searchTerm} party`,
      `${searchTerm} custom`,
      `${searchTerm} personalized`,
    ],
  })
}

function getEvent(optionsOrEventId) {
  const options = typeof optionsOrEventId === 'object' && optionsOrEventId !== null
    ? optionsOrEventId
    : { eventId: optionsOrEventId }
  const customEventName = String(options.customEventName ?? '').trim()

  if (customEventName) return buildCustomMarketEvent(customEventName)

  return MARKET_EVENTS.find((event) => event.id === options.eventId) ?? MARKET_EVENTS[0]
}

export function resolveMarketEvent(options = {}) {
  return getEvent(options)
}

function getCategory(categoryId) {
  return PRODUCT_CATEGORIES.find((category) => category.id === categoryId) ?? PRODUCT_CATEGORIES[0]
}

function countWords(value) {
  return normalizePhrase(value).split(' ').filter(Boolean).length
}

export function isGenericCandidateKeyword(keyword) {
  const tokens = phraseTokens(keyword)
  if (tokens.length === 0) return true
  return tokens.every((token) => GENERIC_WORDS.has(token))
}

function hasRepeatedAdjacentPhrase(value) {
  const tokens = normalizePhrase(value).split(' ').filter(Boolean)
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] === tokens[index + 1]) return true
  }
  for (let index = 0; index < tokens.length - 3; index += 1) {
    if (tokens[index] === tokens[index + 2] && tokens[index + 1] === tokens[index + 3]) return true
  }
  return false
}

export function detectRiskTerms(value, customRiskTerms = []) {
  const source = ` ${normalizePhrase(value)} `
  return unique([...DEFAULT_RISK_TERMS, ...customRiskTerms])
    .map((term) => normalizePhrase(term))
    .filter((term) => term.length >= 2 && source.includes(` ${term} `))
}

function scoreCandidateKeyword(keyword, customRiskTerms = []) {
  const words = countWords(keyword)
  const risks = detectRiskTerms(keyword, customRiskTerms)
  let score = 20

  if (words === 2) score += 8
  if (words >= 4 && words <= 7) score += 25
  if (words >= 8) score += 10
  if (/\b(first|est|gift|matching|from|teacher|mom|dad|grandma|grandpa|nurse)\b/.test(keyword)) score += 20
  if (/\b(book lover|pickleball|camping|fishing|gardening|bride|groom|dog mom|dog dad|cat mom|cat dad|new mom|new dad|retirement|graduation)\b/.test(keyword)) score += 14
  if (/\b(funny|retro|vintage|embroidered|western|personalized|custom)\b/.test(keyword)) score += 10
  if (/\b(2026|2027|party|season|life)\b/.test(keyword)) score += 10
  if (risks.length > 0) score -= 40

  return Math.max(0, Math.min(100, score))
}

function buildKeywordTemplates(event, category, targets, intents, seedKeywords, year) {
  const eventTerm = normalizePhrase(event.searchTerm)
  const product = normalizePhrase(category.searchTerm)
  const templates = []

  for (const target of targets) {
    templates.push(`${target} gift ${product}`)
    templates.push(`${target} ${product}`)
    if (eventTerm) {
      templates.push(`${target} ${eventTerm} ${product}`)
      if (year) templates.push(`${target} ${eventTerm} ${product} ${year}`)
      templates.push(`${eventTerm} ${target} gift ${product}`)
    }
  }

  for (const intent of intents) {
    const phrase = fillTemplate(intent, year)
    if (!phrase) continue
    templates.push(`${phrase} ${product}`)
    for (const target of targets.slice(0, 8)) {
      templates.push(`${phrase} ${target} ${product}`)
    }
  }

  for (const seed of seedKeywords) {
    const normalizedSeed = normalizePhrase(seed)
    const hasEventTerm = eventTerm ? normalizedSeed.includes(eventTerm) : false
    const hasProductTerm = normalizedSeed.includes(product)

    if (hasEventTerm && hasProductTerm) {
      templates.push(normalizedSeed)
    } else if (hasEventTerm) {
      templates.push(`${normalizedSeed} ${product}`)
    } else if (hasProductTerm) {
      templates.push(eventTerm ? `${eventTerm} ${normalizedSeed}` : normalizedSeed)
    } else {
      templates.push(eventTerm ? `${normalizedSeed} ${eventTerm} ${product}` : `${normalizedSeed} ${product}`)
      if (eventTerm) templates.push(`${eventTerm} ${normalizedSeed} ${product}`)
      templates.push(`${normalizedSeed} ${product}`)
    }

    for (const target of targets.slice(0, 6)) {
      if (normalizedSeed.includes(normalizePhrase(target))) continue
      templates.push(`${target} ${normalizedSeed} ${product}`)
    }
  }

  return templates
}

export function generateKeywordCandidates(options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const year = parseOptionalYear(options.year, null)
  const limit = Math.max(10, Math.min(Number(options.limit) || 60, 250))
  const seedKeywords = splitSeedText(options.seedKeywords)
  const selectedTargets = Array.isArray(options.targets) && options.targets.length > 0
    ? options.targets.map((target) => normalizePhrase(target)).filter(Boolean)
    : event.targets
  const discoveryTargets = options.autoDiscovery === false
    ? selectedTargets
    : unique([...selectedTargets, ...autoDiscoveryTerms(category, event)])
  const customRiskTerms = splitSeedText(options.customRiskTerms)
  const intents = unique([
    ...event.intents.map((intent) => fillTemplate(intent, year)).filter(Boolean),
    ...(options.autoDiscovery === false ? [] : autoDiscoveryIntents(category)),
    ...(options.extraIntents ?? []),
  ])

  const keywords = unique(
    buildKeywordTemplates(event, category, discoveryTargets, intents, seedKeywords, year)
      .map((keyword) => normalizePhrase(keyword))
      .filter((keyword) => countWords(keyword) >= 2)
      .filter((keyword) => !isGenericCandidateKeyword(keyword))
      .filter((keyword) => !hasRepeatedAdjacentPhrase(keyword))
  )

  return keywords
    .map((keyword) => {
      const riskTerms = detectRiskTerms(keyword, customRiskTerms)
      return {
        keyword,
        eventId: event.id,
        eventLabel: event.jpLabel,
        categoryId: category.id,
        categoryLabel: category.label,
        score: scoreCandidateKeyword(keyword, customRiskTerms),
        wordCount: countWords(keyword),
        riskTerms,
        status: riskTerms.length > 0 ? 'review' : 'ready',
      }
    })
    .sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword, 'en'))
    .slice(0, limit)
}

export function generateBroadMarketQueries(options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const year = options.includeYear ? parseOptionalYear(options.year, null) : null
  const limit = Math.max(3, Math.min(Number(options.limit) || 18, 40))
  const selectedTargets = Array.isArray(options.targets) && options.targets.length > 0
    ? options.targets.map((target) => normalizePhrase(target)).filter(Boolean)
    : event.targets
  const discoveryTargets = options.autoDiscovery === false
    ? selectedTargets
    : unique([...selectedTargets, ...autoDiscoveryTerms(category, event)])
  const eventTerm = normalizePhrase(event.searchTerm)
  const product = normalizePhrase(category.searchTerm)
  const intentPhrases = unique([
    ...event.intents.map((intent) => fillTemplate(intent, year)).filter(Boolean),
    ...(options.autoDiscovery === false ? [] : autoDiscoveryIntents(category)),
  ])
    .map((intent) => normalizePhrase(intent))
    .filter(Boolean)
  const tagQueries = unique((category.tags ?? [])
    .map((tag) => normalizePhrase(tag))
    .filter((tag) => tag && tag !== product)
    .slice(0, 4)
    .flatMap((tag) => eventTerm ? [`${eventTerm} ${tag}`, `${tag}`] : [tag]))
  const targetQueries = discoveryTargets.slice(0, eventTerm ? 18 : 42).flatMap((target) => (
    eventTerm
      ? [
          `${target} ${product}`,
          `${target} gift`,
          `${eventTerm} ${target}`,
          `${eventTerm} ${target} ${product}`,
        ]
      : [`${target} ${product}`]
  ))
  const intentQueries = intentPhrases.slice(0, 8).flatMap((intent) => [
    intent,
    `${intent} ${product}`,
  ])
  const eventQueries = eventTerm ? [
    `${eventTerm} ${product}`,
    `${eventTerm} gift`,
    `${eventTerm} gift ${product}`,
    `${eventTerm} ${category.tags[0] ?? product}`,
  ] : [
    `funny ${product}`,
    `personalized ${product}`,
    `custom ${product}`,
    `retro ${product}`,
  ]

  const queries = [
    ...eventQueries,
    ...tagQueries,
    ...targetQueries,
    ...intentQueries,
  ]

  return unique(queries)
    .filter((query) => countWords(query) >= 2)
    .slice(0, limit)
}

export function generateFollowUpKeywords(rows = [], options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const year = Number(options.year) || event.defaultYear
  const limit = Math.max(10, Math.min(Number(options.limit) || 80, 250))
  const winners = rankResearchRows(rows, options)
    .filter((row) => {
      const normalized = row.score.normalized
      const hasSales = (normalized.topMonthlySales ?? 0) > 0 || (normalized.topRevenue ?? 0) > 0
      const lowEnoughCompetition = normalized.listingsAnalyzed === null || normalized.listingsAnalyzed < 6000
      return row.score.exclusionReasons.length === 0 && hasSales && lowEnoughCompetition
    })
    .slice(0, 8)

  if (winners.length === 0) return []

  const eventTerm = normalizePhrase(event.searchTerm)
  const productTerm = normalizePhrase(category.searchTerm)
  const seeds = []

  for (const row of winners) {
    const keyword = normalizePhrase(row.keyword)
    const target = inferTarget(keyword, event)
    const compact = normalizePhrase(keyword)
      .replace(new RegExp(`\\b${eventTerm}\\b`, 'g'), ' ')
      .replace(new RegExp(`\\b${productTerm}\\b`, 'g'), ' ')
      .replace(/\b(?:19|20)\d{2}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    seeds.push(compact)
    if (compact !== normalizePhrase(target)) seeds.push(target)

    const tokens = compact.split(' ').filter((token) => token.length >= 3 && !GENERIC_WORDS.has(token))
    for (let index = 0; index < tokens.length - 1; index += 1) {
      seeds.push(`${tokens[index]} ${tokens[index + 1]}`)
    }
  }

  return generateKeywordCandidates({
    ...options,
    seedKeywords: unique([...splitSeedText(options.seedKeywords), ...seeds]).join('\n'),
    limit,
  }).filter((candidate) => !hasRepeatedAdjacentPhrase(candidate.keyword))
    .slice(0, limit)
}

function tokenize(value, stopWords = [], keepWords = []) {
  const stopSet = new Set([
    ...GENERIC_WORDS,
    ...stopWords.flatMap((word) => normalizePhrase(word).split(' ').filter(Boolean)),
  ])
  const keepSet = new Set([...DEFAULT_HINT_KEEP_WORDS, ...keepWords].map((word) => normalizePhrase(word)))

  return normalizePhrase(value)
    .split(' ')
    .filter((token) => token.length >= 3 && (!stopSet.has(token) || keepSet.has(token)))
}

function pushCount(map, token, weight = 1) {
  map.set(token, (map.get(token) ?? 0) + weight)
}

export function extractNicheHintsFromListings(listings = [], limit = 20, options = {}) {
  const counts = new Map()
  const stopWords = options.stopWords ?? []
  const keepWords = options.keepWords ?? []
  const blockedPhrases = new Set((options.blockedPhrases ?? []).map((phrase) => normalizePhrase(phrase)).filter(Boolean))
  const blockedTokens = new Set((options.blockedTokens ?? []).flatMap((phrase) => normalizePhrase(phrase).split(' ').filter(Boolean)))

  const pushHint = (phrase, weight) => {
    const keyword = normalizePhrase(phrase)
    const tokens = keyword.split(' ').filter(Boolean)
    if (!keyword || blockedPhrases.has(keyword)) return
    if (tokens[0] === 'day' || tokens[tokens.length - 1] === 'from') return
    if (tokens.length === 1 && blockedTokens.has(tokens[0])) return
    if (tokens.length > 1 && blockedTokens.has(tokens[tokens.length - 1])) return
    if ([...blockedPhrases].some((blocked) => keyword.includes(blocked)) && !keyword.startsWith('first ')) return
    if (tokens.length > 1 && new Set(tokens).size !== tokens.length) return
    pushCount(counts, keyword, weight)
  }

  for (const listing of listings) {
    const title = listing.product_name ?? listing.title ?? listing.name ?? ''
    const tags = Array.isArray(listing.tags) ? listing.tags.join(' ') : listing.tags ?? ''
    const weightSource = parseNumber(listing.est_sales ?? listing.sales ?? listing.monthlySales ?? 0) ?? 0
    const weight = Math.max(1, Math.min(10, Math.round(weightSource / 10) || 1))
    const tagSegments = String(tags).split(/[,;|]+/).filter(Boolean)
    const segments = [title, ...tagSegments]
    const seenTokens = new Set()

    for (const segment of segments) {
      const tokens = tokenize(segment, stopWords, keepWords)
      for (const token of tokens) {
        if (seenTokens.has(token)) continue
        seenTokens.add(token)
        pushHint(token, weight)
      }

      for (let size = 2; size <= 3; size += 1) {
        for (let index = 0; index <= tokens.length - size; index += 1) {
          const phrase = tokens.slice(index, index + size).join(' ')
          if (phrase.length >= 7) pushHint(phrase, weight + size)
        }
      }
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }))
}

export function parseNumber(value) {
  if (value === null || value === undefined) return null
  const cleaned = String(value).replace(/[$,%\s,]/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseListingAgeMonths(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const source = String(value).toLowerCase().trim()
  const numberMatch = source.match(/\d+(?:\.\d+)?/)
  const number = numberMatch ? Number(numberMatch[0]) : parseNumber(source)
  if (number === null) return null
  if (/\b(year|years|yr|yrs)\b/.test(source)) return Math.round(number * 12)
  if (/\b(day|days)\b/.test(source)) return Math.max(1, Math.round(number / 30))
  return Math.round(number)
}

function scoreBand(value, bands) {
  for (const band of bands) {
    if (band.test(value)) return band.points
  }
  return 0
}

export function scoreEverbeeResult(row = {}, options = {}) {
  const keyword = normalizePhrase(row.keyword)
  const listingsAnalyzed = parseNumber(row.listingsAnalyzed)
  const topMonthlySales = parseNumber(row.topMonthlySales)
  const topRevenue = parseNumber(row.topRevenue)
  const averagePrice = parseNumber(row.averagePrice)
  const listingAgeMonths = parseListingAgeMonths(row.listingAge)
  const erankSearchVolume = parseNumber(row.erankSearchVolume)
  const erankClicks = parseNumber(row.erankClicks)
  const erankCtr = parseNumber(row.erankCtr)
  const erankCompetition = parseNumber(row.erankCompetition)
  const erankKeywordDifficulty = parseNumber(row.erankKeywordDifficulty)
  const erankTrend = parseNumber(row.erankTrend)
  const riskTerms = detectRiskTerms(`${keyword} ${row.notes ?? ''}`, splitSeedText(options.customRiskTerms))

  const competitionScore = scoreBand(listingsAnalyzed, [
    { test: (value) => value !== null && value > 0 && value < 1000, points: 30 },
    { test: (value) => value !== null && value < 3000, points: 24 },
    { test: (value) => value !== null && value < 6000, points: 14 },
    { test: (value) => value !== null && value < 10000, points: 6 },
  ])
  const demandScore = scoreBand(topMonthlySales, [
    { test: (value) => value !== null && value >= 30, points: 25 },
    { test: (value) => value !== null && value >= 10, points: 20 },
    { test: (value) => value !== null && value >= 5, points: 10 },
    { test: (value) => value !== null && value > 0, points: 4 },
  ])
  const revenueScore = scoreBand(topRevenue, [
    { test: (value) => value !== null && value >= 1000, points: 20 },
    { test: (value) => value !== null && value >= 300, points: 16 },
    { test: (value) => value !== null && value >= 100, points: 8 },
    { test: (value) => value !== null && value > 0, points: 3 },
  ])
  const trendScore = scoreBand(listingAgeMonths, [
    { test: (value) => value !== null && value >= 2 && value <= 6 && (topMonthlySales ?? 0) >= 10, points: 18 },
    { test: (value) => value !== null && value >= 2 && value <= 12 && (topMonthlySales ?? 0) >= 10, points: 15 },
    { test: (value) => value !== null && value <= 18 && (topMonthlySales ?? 0) > 0, points: 7 },
    { test: (value) => value !== null && value < 2 && (topMonthlySales ?? 0) >= 10, points: 6 },
  ])
  const priceScore = scoreBand(averagePrice, [
    { test: (value) => value !== null && value >= 18 && value <= 35, points: 10 },
    { test: (value) => value !== null && value >= 12 && value <= 45, points: 6 },
    { test: (value) => value !== null && value > 0, points: 2 },
  ])
  const erankDemandScore = Math.max(
    scoreBand(erankSearchVolume, [
      { test: (value) => value !== null && value >= 1000, points: 12 },
      { test: (value) => value !== null && value >= 300, points: 8 },
      { test: (value) => value !== null && value > 0, points: 3 },
    ]),
    scoreBand(erankClicks, [
      { test: (value) => value !== null && value >= 500, points: 12 },
      { test: (value) => value !== null && value >= 100, points: 8 },
      { test: (value) => value !== null && value > 0, points: 3 },
    ])
  )
  const erankCompetitionScore = scoreBand(erankCompetition, [
    { test: (value) => value !== null && value > 0 && value < 5000, points: 8 },
    { test: (value) => value !== null && value < 20000, points: 5 },
    { test: (value) => value !== null && value < 50000, points: 2 },
  ])
  const erankCtrScore = scoreBand(erankCtr, [
    { test: (value) => value !== null && value >= 70, points: 5 },
    { test: (value) => value !== null && value >= 45, points: 3 },
    { test: (value) => value !== null && value > 0, points: 1 },
  ])
  const erankKeywordDifficultyScore = scoreBand(erankKeywordDifficulty, [
    { test: (value) => value !== null && value >= 0 && value <= 10, points: 8 },
    { test: (value) => value !== null && value <= 25, points: 6 },
    { test: (value) => value !== null && value <= 45, points: 3 },
    { test: (value) => value !== null && value <= 60, points: 1 },
  ])
  const erankTrendScore = scoreBand(erankTrend, [
    { test: (value) => value !== null && value > 0, points: 3 },
  ])

  const oldReferencePenalty = listingAgeMonths !== null && listingAgeMonths >= 24
    ? ((topMonthlySales ?? 0) >= 30 ? 6 : 14)
    : 0
  const tooFreshPenalty = listingAgeMonths !== null && listingAgeMonths < 2 && (topMonthlySales ?? 0) < 10 ? 8 : 0
  const riskPenalty = riskTerms.length * 25 + oldReferencePenalty + tooFreshPenalty
  const score = Math.max(0, Math.min(100, competitionScore + demandScore + revenueScore + trendScore + priceScore + erankDemandScore + erankCompetitionScore + erankCtrScore + erankKeywordDifficultyScore + erankTrendScore - riskPenalty))
  const hasEverbeeData = listingsAnalyzed !== null || topMonthlySales !== null || topRevenue !== null
  const hasErankData = erankSearchVolume !== null || erankClicks !== null || erankCtr !== null || erankCompetition !== null || erankKeywordDifficulty !== null || erankTrend !== null
  const everbeePositive = (topMonthlySales ?? 0) > 0 || (topRevenue ?? 0) > 0
  const erankPositive = (erankSearchVolume ?? 0) > 0 || (erankClicks ?? 0) > 0 || (erankCtr ?? 0) > 0
  const exclusionReasons = []
  if (listingAgeMonths !== null && listingAgeMonths >= 24 && (topMonthlySales ?? 0) < 10) exclusionReasons.push('古い商品中心のため参考のみ')
  if (listingAgeMonths !== null && listingAgeMonths < 2 && (topMonthlySales ?? 0) < 10) exclusionReasons.push('新しすぎて売上確認が弱い')
  if (riskTerms.length > 0) exclusionReasons.push(`要確認語句: ${riskTerms.join(', ')}`)
  if ((listingsAnalyzed ?? 0) >= 10000 && (topMonthlySales ?? 0) < 10) exclusionReasons.push('競合が多く需要が弱い')
  if (!hasEverbeeData && hasErankData && !erankPositive) exclusionReasons.push('eRank検索需要が未確認')
  if (hasEverbeeData && !everbeePositive && hasErankData && !erankPositive) exclusionReasons.push('売上と検索需要の両方が弱い')

  let label = 'C: 追加調査'
  if (exclusionReasons.length > 0) label = 'D: 除外候補'
  else if (score >= 80) label = 'A: 今すぐ候補'
  else if (score >= 62) label = 'B: 有望'
  if (hasErankData && erankPositive && hasEverbeeData && !everbeePositive && label !== 'D: 除外候補') label = 'C: 検索需要あり'

  let validationLabel = '未検証'
  if (hasEverbeeData && hasErankData && everbeePositive && erankPositive) validationLabel = '両方OK'
  else if (hasEverbeeData && hasErankData) validationLabel = '要判断'
  else if (hasEverbeeData) validationLabel = 'EverBeeのみ'
  else if (hasErankData) validationLabel = 'eRankのみ'

  return {
    score,
    label,
    parts: {
      competitionScore,
      demandScore,
      revenueScore,
      trendScore,
      priceScore,
      erankDemandScore,
      erankCompetitionScore,
      erankCtrScore,
      erankKeywordDifficultyScore,
      erankTrendScore,
      oldReferencePenalty,
      tooFreshPenalty,
      riskPenalty,
    },
    validation: {
      label: validationLabel,
      hasEverbeeData,
      hasErankData,
      everbeePositive,
      erankPositive,
    },
    normalized: {
      keyword,
      listingsAnalyzed,
      topMonthlySales,
      topRevenue,
      averagePrice,
      listingAgeMonths,
      erankSearchVolume,
      erankClicks,
      erankCtr,
      erankCompetition,
      erankKeywordDifficulty,
      erankTrend,
      notes: row.notes ?? '',
    },
    riskTerms,
    exclusionReasons,
  }
}

export function scoreErankOpportunity(row = {}, options = {}) {
  const keyword = normalizePhrase(row.keyword)
  const erankSearchVolume = parseNumber(row.erankSearchVolume)
  const erankClicks = parseNumber(row.erankClicks)
  const erankCtr = parseNumber(row.erankCtr)
  const erankCompetition = parseNumber(row.erankCompetition)
  const erankKeywordDifficulty = parseNumber(row.erankKeywordDifficulty)
  const erankTrend = parseNumber(row.erankTrend)
  const riskTerms = detectRiskTerms(`${keyword} ${row.notes ?? ''}`, splitSeedText(options.customRiskTerms))

  const searchScore = scoreBand(erankSearchVolume, [
    { test: (value) => value !== null && value >= 1000, points: 22 },
    { test: (value) => value !== null && value >= 300, points: 16 },
    { test: (value) => value !== null && value >= 100, points: 10 },
    { test: (value) => value !== null && value > 0, points: 5 },
  ])
  const clickScore = scoreBand(erankClicks, [
    { test: (value) => value !== null && value >= 500, points: 22 },
    { test: (value) => value !== null && value >= 100, points: 16 },
    { test: (value) => value !== null && value >= 30, points: 10 },
    { test: (value) => value !== null && value > 0, points: 5 },
  ])
  const ctrScore = scoreBand(erankCtr, [
    { test: (value) => value !== null && value >= 100, points: 14 },
    { test: (value) => value !== null && value >= 70, points: 12 },
    { test: (value) => value !== null && value >= 45, points: 8 },
    { test: (value) => value !== null && value > 0, points: 3 },
  ])
  const competitionScore = scoreBand(erankCompetition, [
    { test: (value) => value !== null && value > 0 && value < 5000, points: 22 },
    { test: (value) => value !== null && value < 20000, points: 14 },
    { test: (value) => value !== null && value < 50000, points: 8 },
    { test: (value) => value !== null && value > 0, points: 2 },
  ])
  const keywordDifficultyScore = scoreBand(erankKeywordDifficulty, [
    { test: (value) => value !== null && value >= 0 && value <= 10, points: 22 },
    { test: (value) => value !== null && value <= 25, points: 18 },
    { test: (value) => value !== null && value <= 45, points: 10 },
    { test: (value) => value !== null && value <= 60, points: 4 },
  ])
  const trendScore = scoreBand(erankTrend, [
    { test: (value) => value !== null && value >= 500, points: 8 },
    { test: (value) => value !== null && value > 0, points: 5 },
  ])
  const hasErankData = erankSearchVolume !== null
    || erankClicks !== null
    || erankCtr !== null
    || erankCompetition !== null
    || erankKeywordDifficulty !== null
    || erankTrend !== null
  const hasDemand = (erankSearchVolume ?? 0) > 0 || (erankClicks ?? 0) > 0 || (erankCtr ?? 0) > 0
  const riskPenalty = riskTerms.length * 30
  const competitionConfidenceScore = Math.max(competitionScore, keywordDifficultyScore)
  const missingCompetitionSignal = erankCompetition === null && erankKeywordDifficulty === null
  const rawScore = searchScore + clickScore + ctrScore + competitionConfidenceScore + trendScore - riskPenalty
  const cappedScore = missingCompetitionSignal && rawScore >= 62 ? 61 : rawScore
  const score = hasErankData && hasDemand
    ? Math.max(0, Math.min(100, cappedScore))
    : 0

  const reasons = []
  if ((erankSearchVolume ?? 0) >= 1000) reasons.push('検索数が強い')
  else if ((erankSearchVolume ?? 0) >= 300) reasons.push('検索数あり')
  else if ((erankSearchVolume ?? 0) > 0) reasons.push('少量の検索あり')
  if ((erankClicks ?? 0) >= 500) reasons.push('クリックが強い')
  else if ((erankClicks ?? 0) >= 100) reasons.push('クリックあり')
  if ((erankCtr ?? 0) >= 70) reasons.push('CTR高め')
  if (erankKeywordDifficulty !== null && erankKeywordDifficulty <= 25) reasons.push('KD低め')
  if (erankCompetition !== null && erankCompetition > 0 && erankCompetition < 5000) reasons.push('競合少なめ')
  if (erankCompetition === null) reasons.push('競合数は未取得')
  if (erankKeywordDifficulty === null) reasons.push('KD未取得')
  if (erankTrend !== null && erankTrend > 0) reasons.push('トレンド反応あり')
  if (!hasDemand) reasons.push('検索需要が未確認')
  if (riskTerms.length > 0) reasons.push(`要確認語句: ${riskTerms.join(', ')}`)

  let action = 'hold'
  let label = '今回は保留'
  if (riskTerms.length > 0) {
    action = 'reject'
    label = '除外候補'
  } else if (!hasDemand) {
    action = 'reject'
    label = '需要未確認'
  } else if (score >= 62) {
    action = 'everbee'
    label = 'EverBeeへ送る'
  } else if (score >= 40) {
    action = 'expand'
    label = '関連語を追加探索'
  }

  return {
    score,
    label,
    action,
    reasons,
    riskTerms,
    missingCompetitionSignal,
    normalized: {
      keyword,
      erankSearchVolume,
      erankClicks,
      erankCtr,
      erankCompetition,
      erankKeywordDifficulty,
      erankTrend,
    },
    parts: {
      searchScore,
      clickScore,
      ctrScore,
      competitionScore,
      keywordDifficultyScore,
      trendScore,
      riskPenalty,
    },
  }
}

function inferTarget(keyword, event) {
  const source = normalizePhrase(keyword)
  const matches = event.targets
    .filter((target) => source.includes(normalizePhrase(target)))
    .sort((left, right) => normalizePhrase(right).length - normalizePhrase(left).length)
  if (matches[0]) return matches[0]
  if (event.id === 'auto-discovery' || !normalizePhrase(event.searchTerm)) return 'niche buyer'
  return event.targets[0]
}

function cleanTag(value) {
  return normalizePhrase(value).slice(0, 20).trim()
}

export function parseBucketKeywords(value) {
  if (Array.isArray(value)) {
    return unique(value.flatMap((item) => {
      if (typeof item === 'string') return splitSeedText(item)
      return splitSeedText(item?.keyword ?? '')
    }))
  }

  return unique(splitSeedText(value))
}

function buildTags(keyword, event, category, year, target) {
  const tokens = normalizePhrase(keyword).split(' ').filter(Boolean)
  const chunks = []
  for (let index = 0; index < tokens.length - 1; index += 1) {
    chunks.push(`${tokens[index]} ${tokens[index + 1]}`)
  }
  for (let index = 0; index < tokens.length - 2; index += 1) {
    chunks.push(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`)
  }

  return unique([
    keyword,
    target,
    event.searchTerm,
    `${event.searchTerm} gift`,
    `${target} gift`,
    category.searchTerm,
    ...category.tags,
    ...chunks,
    String(year),
  ])
    .map(cleanTag)
    .filter((tag) => tag.length >= 2 && tag.length <= 20)
    .slice(0, 13)
}

function titleizeKeyword(value) {
  const smallWords = new Set(['a', 'an', 'and', 'for', 'of', 'the', 'to', 'with'])
  return normalizePhrase(value)
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word
      if (/^\d+$/.test(word)) return word
      return `${word[0].toUpperCase()}${word.slice(1)}`
    })
    .join(' ')
    .replace(/\bFathers\b/g, "Father's")
    .replace(/\bMothers\b/g, "Mother's")
    .replace(/\bValentines\b/g, "Valentine's")
}

function hasDemandFromEverbee(normalized) {
  return (normalized.topMonthlySales ?? 0) >= 10 || (normalized.topRevenue ?? 0) >= 300
}

function hasDemandFromErank(normalized) {
  return (normalized.erankSearchVolume ?? 0) >= 300 || (normalized.erankClicks ?? 0) >= 100
}

function hasStrongDemand(normalized) {
  return (normalized.topMonthlySales ?? 0) >= 30
    || (normalized.topRevenue ?? 0) >= 1000
    || (normalized.erankSearchVolume ?? 0) >= 1000
    || (normalized.erankClicks ?? 0) >= 500
}

function competitionLevel(normalized) {
  const erankCompetition = normalized.erankCompetition
  const erankKeywordDifficulty = normalized.erankKeywordDifficulty
  const listingsAnalyzed = normalized.listingsAnalyzed

  if ((erankKeywordDifficulty !== null && erankKeywordDifficulty <= 25)
    || (erankCompetition !== null && erankCompetition > 0 && erankCompetition < 5000)
    || (listingsAnalyzed !== null && listingsAnalyzed > 0 && listingsAnalyzed < 3000)) {
    return 'low'
  }

  if ((erankKeywordDifficulty !== null && erankKeywordDifficulty <= 50)
    || (erankCompetition !== null && erankCompetition < 20000)
    || (listingsAnalyzed !== null && listingsAnalyzed < 8000)) {
    return 'medium'
  }

  if (erankCompetition !== null || erankKeywordDifficulty !== null || listingsAnalyzed !== null) return 'high'
  return 'unknown'
}

export function classifyKeywordBucket(row = {}, options = {}) {
  const score = row.score?.normalized ? row.score : scoreEverbeeResult(row, options)
  const normalized = score.normalized
  const keyword = normalized.keyword
  const hasRisk = score.riskTerms.length > 0
  const hasDemand = hasDemandFromEverbee(normalized) || hasDemandFromErank(normalized)
  const strongDemand = hasStrongDemand(normalized)
  const competition = competitionLevel(normalized)

  if (!keyword) {
    return { bucket: 'exclude', label: '除外', reason: 'キーワードが空です', score }
  }

  if (hasRisk) {
    return { bucket: 'exclude', label: '除外候補', reason: `商標/著作権っぽい語句: ${score.riskTerms.join(', ')}`, score }
  }

  if (hasDemand && competition === 'low') {
    return { bucket: 'visibility', label: 'Visibility', reason: '検索需要または売上があり、競合が低めです', score }
  }

  if (strongDemand && competition === 'high') {
    return { bucket: 'bestSeller', label: 'Best seller', reason: '需要が大きく、競合も大きい市場語です', score }
  }

  if (hasDemand && (competition === 'medium' || competition === 'unknown')) {
    return { bucket: 'reach', label: 'Reach', reason: '需要があり、広げるための中核語に向きます', score }
  }

  if (strongDemand) {
    return { bucket: 'bestSeller', label: 'Best seller', reason: '強い需要が確認できます', score }
  }

  return { bucket: 'review', label: '追加確認', reason: '需要または競合の根拠がまだ弱いです', score }
}

function phraseTokens(value) {
  return normalizePhrase(value).split(' ').filter(Boolean)
}

function phraseAddsSignal(phrase, usedTokens) {
  const tokens = phraseTokens(phrase).filter((token) => !GENERIC_WORDS.has(token))
  if (tokens.length === 0) return false
  return tokens.some((token) => !usedTokens.has(token))
}

function buildSeoTitle(phrases, event, category) {
  const usedTokens = new Set()
  const pieces = []
  const fallback = `${event.searchTerm} ${category.searchTerm}`

  for (const phrase of unique([...phrases, `${event.searchTerm} gift`, category.searchTerm, fallback])) {
    const normalized = normalizePhrase(phrase)
    if (!normalized) continue
    if (pieces.length > 0 && !phraseAddsSignal(normalized, usedTokens)) continue

    const nextPieces = [...pieces, normalized]
    const nextTitle = nextPieces.map(titleizeKeyword).join(', ')
    if (nextTitle.length > 140) continue

    pieces.push(normalized)
    phraseTokens(normalized).forEach((token) => usedTokens.add(token))
  }

  let title = pieces.map(titleizeKeyword).join(', ')
  if (title.length <= 140) return title

  while (pieces.length > 1 && title.length > 140) {
    pieces.pop()
    title = pieces.map(titleizeKeyword).join(', ')
  }

  return title.slice(0, 140).trim()
}

function isUsefulTagChunk(chunk) {
  const edgeStopWords = new Set(['to', 'be', 'and', 'for', 'the', 'with', 'of', 'day'])
  const tokens = phraseTokens(chunk)
  if (tokens.length === 0) return false
  const endsWithToBe = tokens.length >= 3 && tokens[tokens.length - 2] === 'to' && tokens[tokens.length - 1] === 'be'
  if (edgeStopWords.has(tokens[0])) return false
  if (tokens[0] === 'est') return false
  if (/^\d{4}$/.test(tokens[0]) && ['dad', 'mom', 'grandpa', 'grandma', 'papa', 'mama'].includes(tokens[1])) return false
  if (['fathers', 'mothers', 'valentines'].some((eventWord) => tokens.includes(eventWord) && tokens[0] !== eventWord)) return false
  if (edgeStopWords.has(tokens[tokens.length - 1]) && !endsWithToBe) return false
  if (tokens.every((token) => GENERIC_WORDS.has(token))) return false
  if (tokens.length === 1 && (GENERIC_WORDS.has(tokens[0]) || tokens[0].length < 4)) return false
  return true
}

function tagChunks(phrase) {
  const tokens = phraseTokens(phrase)
  const chunks = []
  const normalized = normalizePhrase(phrase)
  if (normalized.length <= 20) chunks.push(normalized)

  for (let size = 3; size >= 2; size -= 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const chunk = tokens.slice(index, index + size).join(' ')
      if (chunk.length >= 2 && chunk.length <= 20 && isUsefulTagChunk(chunk)) chunks.push(chunk)
    }
  }

  return chunks
}

function buildSeoTags(phrases, event, category, year) {
  const joinedPhrases = phrases.join(' ')
  const target = event.targets.find((item) => normalizePhrase(joinedPhrases).includes(normalizePhrase(item)))
  const targetTags = target
    ? [target, `${target} gift`, `${target} ${category.searchTerm}`]
    : []

  return unique([
    ...phrases.filter((phrase) => normalizePhrase(phrase).length <= 20),
    ...targetTags,
    event.searchTerm,
    `${event.searchTerm} gift`,
    category.searchTerm,
    ...category.tags,
    ...phrases.flatMap(tagChunks),
    String(year),
  ])
    .map(cleanTag)
    .filter((tag) => tag.length >= 2 && tag.length <= 20)
    .slice(0, 13)
}

export function buildSeoPlanFromBuckets(buckets = {}, options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const year = Number(options.year) || event.defaultYear
  const customRiskTerms = splitSeedText(options.customRiskTerms)
  const visibility = parseBucketKeywords(buckets.visibility)
  const reach = parseBucketKeywords(buckets.reach)
  const bestSeller = parseBucketKeywords(buckets.bestSeller)
  const warnings = []
  const selectedPhrases = unique([
    ...visibility.slice(0, 3),
    ...reach.slice(0, 4),
    ...bestSeller.slice(0, 3),
  ])
  const riskTerms = detectRiskTerms(selectedPhrases.join(' '), customRiskTerms)

  if (visibility.length === 0) warnings.push('Visibilityに入る低競合キーワードがまだありません')
  if (reach.length === 0) warnings.push('Reachに入る中核キーワードがまだありません')
  if (bestSeller.length === 0) warnings.push('Best sellerに入る大きな市場語がまだありません')
  if (riskTerms.length > 0) warnings.push(`商標/著作権っぽい語句を確認してください: ${riskTerms.join(', ')}`)

  const title = buildSeoTitle(selectedPhrases, event, category)
  const tags = buildSeoTags(selectedPhrases, event, category, year)

  if (title.length > 140) warnings.push('タイトルが140文字を超えています')
  if (tags.length < 8) warnings.push('タグ候補が少なめです。eRank/EverBeeから関連語をもう少し追加してください')

  return {
    title,
    titleLength: title.length,
    tags,
    tagString: tags.join(', '),
    warnings,
    buckets: {
      visibility,
      reach,
      bestSeller,
    },
  }
}

function sourceHasPhrase(source, tokens, phrase) {
  const normalized = normalizePhrase(phrase)
  if (!normalized) return false
  const phraseTokensValue = phraseTokens(normalized)
  if (phraseTokensValue.length === 1) return tokens.has(phraseTokensValue[0])
  return source.includes(normalized)
}

function collectVisualSignals(keyword, event, category, target) {
  const categoryGuidance = CATEGORY_VISUAL_GUIDANCE[category.id] ?? CATEGORY_VISUAL_GUIDANCE.shirt
  const source = normalizePhrase([
    keyword,
    event.searchTerm,
    event.displayTerm,
    target,
    category.searchTerm,
    ...(category.tags ?? []),
  ].join(' '))
  const tokens = new Set(phraseTokens(source))
  const matches = VISUAL_SIGNAL_LIBRARY.filter((entry) => (
    entry.phrases.some((phrase) => sourceHasPhrase(source, tokens, phrase))
  ))

  const fallbackMain = [
    `${target} typography`,
    event.searchTerm ? `${event.searchTerm} icon` : 'simple niche icon',
  ]
  const main = unique([
    ...(categoryGuidance.main ?? []),
    ...matches.flatMap((entry) => entry.main ?? []),
    ...(matches.length === 0 ? fallbackMain : []),
  ]).slice(0, 8)
  const supporting = unique([
    ...(categoryGuidance.supporting ?? []),
    ...matches.flatMap((entry) => entry.supporting ?? []),
    'small sparkle accent',
  ]).slice(0, 10)
  const mood = unique([
    ...matches.flatMap((entry) => entry.mood ?? []),
    ...event.designAngles.slice(0, 3),
  ]).slice(0, 8)
  const avoid = unique([
    ...matches.flatMap((entry) => entry.avoid ?? []),
    'brand logos',
    'copyrighted characters',
    'celebrity faces',
    'official seals',
    'mockup backgrounds',
  ]).slice(0, 10)

  return {
    main,
    supporting,
    mood,
    avoid,
    productNote: categoryGuidance.productNote,
    matchedSignals: matches.flatMap((entry) => entry.phrases.slice(0, 1)),
  }
}

const NON_NOUN_MATERIAL_WORDS = new Set([
  'graphic',
  'typography',
  'background',
  'layout',
  'composition',
  'print',
  'printable',
  'style',
  'texture',
  'mockup',
  'color',
  'colors',
  'palette',
  'accent',
  'accents',
])

const NOUN_STOP_WORDS = new Set([
  ...GENERIC_WORDS,
  'gift',
  'gifts',
  'shirt',
  'shirts',
  'sweatshirt',
  'sweatshirts',
  'mug',
  'mugs',
  'tote',
  'bag',
  'bags',
  'sticker',
  'stickers',
  'custom',
  'personalized',
  'matching',
  'funny',
  'retro',
  'vintage',
  'embroidered',
  'minimalist',
  'cute',
  'day',
  'year',
  'est',
  'father',
  'fathers',
  'mother',
  'mothers',
  'dad',
  'mom',
  'papa',
  'mama',
  'grandpa',
  'grandma',
  'men',
  'mens',
  'women',
  'womens',
  'girl',
  'boy',
  'kid',
  'kids',
  'lover',
  'buyer',
  'owner',
  'fan',
  'people',
  'person',
  'niche',
  'text',
  'words',
  'lettering',
  'valentine',
  'valentines',
  'summerween',
  'halloween',
  'christmas',
  'thanksgiving',
  'easter',
  'independence',
  'july',
  'heart',
  'hearts',
  'star',
  'stars',
  'sparkle',
  'sparkles',
])

function normalizeNounCandidate(value) {
  const normalized = normalizePhrase(value)
  if (!normalized) return ''
  const tokens = phraseTokens(normalized)
  if (tokens.some((token) => NON_NOUN_MATERIAL_WORDS.has(token))) return ''

  const cleanedTokens = tokens
    .filter((token) => !['icon', 'icons', 'silhouette', 'shape', 'line', 'lines', 'curve', 'curves', 'frame', 'border', 'small', 'bold', 'simple'].includes(token))
    .filter((token) => !NOUN_STOP_WORDS.has(token))

  if (cleanedTokens.length === 0) return ''

  const cleaned = cleanedTokens.join(' ')
    .replace(/\bdog face\b/g, 'dog')
    .replace(/\bcat face\b/g, 'cat')
    .replace(/\bfloral\b/g, 'flowers')
    .replace(/\bflag inspired stripes\b/g, 'flag stripes')
    .trim()

  return cleaned.length >= 2 ? cleaned : ''
}

function keywordNounCandidates(keyword, event, category, target) {
  const eventTokens = new Set(phraseTokens(event.searchTerm))
  const categoryTokens = new Set([
    ...phraseTokens(category.searchTerm),
    ...(category.tags ?? []).flatMap(phraseTokens),
  ])
  const targetTokens = new Set(phraseTokens(target))
  const blocked = (token) => (
    eventTokens.has(token)
    || categoryTokens.has(token)
    || targetTokens.has(token)
    || NOUN_STOP_WORDS.has(token)
    || /^\d+$/.test(token)
  )
  const chunks = []
  let current = []

  for (const token of phraseTokens(keyword)) {
    if (blocked(token)) {
      if (current.length > 0) chunks.push(current.join(' '))
      current = []
    } else {
      current.push(token)
    }
  }
  if (current.length > 0) chunks.push(current.join(' '))

  return unique(chunks.map(normalizeNounCandidate).filter(Boolean))
}

function buildNounBrief(keyword, event, category, target) {
  const signals = collectVisualSignals(keyword, event, category, target)
  const keywordNouns = keywordNounCandidates(keyword, event, category, target)
  const heroNouns = unique([
    ...keywordNouns,
    ...signals.main.map(normalizeNounCandidate),
  ])
    .filter(Boolean)
    .filter((noun) => !['heart', 'star', 'sparkle'].includes(noun))
    .slice(0, 8)
  const relatedNouns = unique([
    ...signals.supporting.map(normalizeNounCandidate),
    ...signals.main.map(normalizeNounCandidate).slice(2),
  ])
    .filter(Boolean)
    .filter((noun) => !heroNouns.includes(noun))
    .slice(0, 12)
  const unsafeNouns = unique(signals.avoid
    .flatMap((value) => {
      const source = normalizePhrase(value)
      if (source.includes('logo')) return ['logo']
      if (source.includes('character')) return ['licensed character']
      if (source.includes('mascot')) return ['mascot']
      if (source.includes('seal')) return ['official seal']
      if (source.includes('celebrity')) return ['celebrity']
      return []
    }))

  return {
    sourceNote: '流行キーワードから、デザインの主役になり得る名詞だけを抜き出しています。構図・色・雰囲気はEtsyMiraiProducer側の売れ筋デザイン分析に任せます。',
    heroNouns,
    relatedNouns,
    unsafeNouns,
    sourceSignals: unique(signals.matchedSignals).filter(Boolean),
    usableForTypography: heroNouns.length === 0
      ? 'タイポグラフィ型なら名詞なしでも進められます。画像素材型にする場合は、上位商品の商品名やタグから名詞を追加してください。'
      : 'EtsyMiraiProducerで画像素材型を選ぶ時だけ使います。タイポグラフィ型なら無理に使いません。',
  }
}

export function buildProductIdea(keyword, options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const year = Number(options.year) || event.defaultYear
  const normalizedKeyword = normalizePhrase(keyword)
  const target = inferTarget(normalizedKeyword, event)
  const nounBrief = buildNounBrief(normalizedKeyword, event, category, target)
  const seoPlan = buildSeoPlanFromBuckets({
    visibility: [normalizedKeyword],
  }, {
    ...options,
    eventId: event.id,
    categoryId: category.id,
    year,
  })
  const seoTitle = seoPlan.title || titleizeKeyword(`${normalizedKeyword} ${category.searchTerm}`).slice(0, 135)
  const tags = seoPlan.tags.length > 0 ? seoPlan.tags : buildTags(normalizedKeyword, event, category, year, target)

  return {
    theme: `${event.jpLabel}向け ${target} ${category.label}`,
    target,
    nounBrief,
    seoTitle,
    tags,
    notes: detectRiskTerms(normalizedKeyword).length > 0
      ? '商標・著作権の確認が必要です。'
      : 'EverBee数値が良ければ商品化候補にできます。',
  }
}

function detectDelimiter(text) {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim()) ?? ''
  if ((firstLine.match(/\t/g) ?? []).length > (firstLine.match(/,/g) ?? []).length) return '\t'
  return ','
}

function parseDelimitedLine(line, delimiter) {
  const values = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]
    if (char === '"' && quoted && nextChar === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

function matchHeader(header) {
  const normalized = normalizePhrase(header)
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((alias) => normalizePhrase(alias) === normalized)) return field
  }
  return null
}

function matchBroadListingHeader(header) {
  const normalized = normalizePhrase(header)
  for (const [field, aliases] of Object.entries(BROAD_LISTING_FIELD_ALIASES)) {
    if (aliases.some((alias) => normalizePhrase(alias) === normalized)) return field
  }
  return null
}

function parseBroadLineWithoutHeader(line, delimiter) {
  const values = parseDelimitedLine(line, delimiter)
  if (delimiter === '\t' && values.length > 1) {
    return {
      title: values[0],
      tags: values[1] ?? '',
      sales: values[2] ?? '',
      revenue: values[3] ?? '',
    }
  }

  return { title: line }
}

export function parseBroadMarketListings(text) {
  const source = String(text ?? '').trim()
  if (!source) return []

  const delimiter = detectDelimiter(source)
  const lines = source.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const firstRow = parseDelimitedLine(lines[0], delimiter)
  const headerFields = firstRow.map(matchBroadListingHeader)
  const hasHeader = headerFields.some(Boolean)

  if (!hasHeader) {
    return lines
      .map((line) => parseBroadLineWithoutHeader(line, delimiter))
      .filter((row) => normalizePhrase(`${row.title ?? ''} ${row.tags ?? ''}`))
  }

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter)
    const row = {}
    values.forEach((value, index) => {
      const field = headerFields[index]
      if (field) row[field] = value
    })
    return row
  }).filter((row) => normalizePhrase(`${row.title ?? ''} ${row.tags ?? ''}`))
}

export function parseEverbeeRows(text) {
  const source = String(text ?? '').trim()
  if (!source) return []

  const delimiter = detectDelimiter(source)
  const lines = source.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const firstRow = parseDelimitedLine(lines[0], delimiter)
  const headerFields = firstRow.map(matchHeader)
  const hasHeader = headerFields.some(Boolean)
  const rows = hasHeader ? lines.slice(1) : lines
  const fallbackFields = ['keyword', 'listingsAnalyzed', 'topMonthlySales', 'topRevenue', 'averagePrice', 'listingAge', 'erankSearchVolume', 'erankClicks', 'erankCtr', 'erankCompetition', 'erankKeywordDifficulty', 'erankTrend', 'notes']
  const fields = hasHeader ? headerFields : fallbackFields

  return rows.map((line) => {
    const values = parseDelimitedLine(line, delimiter)
    const row = {}
    values.forEach((value, index) => {
      const field = fields[index]
      if (field) row[field] = value
    })
    return row
  }).filter((row) => row.keyword)
}

export function rankResearchRows(rows = [], options = {}) {
  return rows
    .map((row) => {
      const score = scoreEverbeeResult(row, options)
      const idea = buildProductIdea(row.keyword, options)
      return { ...row, score, idea }
    })
    .sort((a, b) => b.score.score - a.score.score || normalizePhrase(a.keyword).localeCompare(normalizePhrase(b.keyword), 'en'))
}

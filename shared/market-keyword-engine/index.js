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
  'wall-art': ['nursery', 'printable', 'poster', 'quote', 'boho', 'minimalist'],
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

const HALLOWEEN_DISCOVERY_PROFILE = {
  enabled: true,
  lanes: {
    motif: ['ghost', 'black cat', 'bat', 'pumpkin', 'skeleton', 'witch', 'monster', 'spider web'],
    moment: ['pumpkin patch', 'trick or treat', 'haunted house', 'spooky party host', 'classroom party', 'boo crew', 'costume party', 'october birthday crew'],
    audience: ['teacher', 'nurse', 'book lover', 'dog mom', 'cat mom', 'family', 'couples', 'coworker'],
    aesthetic: ['retro', 'cute', 'gothic', 'minimalist', 'vintage', 'coquette', 'western', 'embroidered'],
    adjacent: ['spooky season', 'fall reading', 'autumn ghost', 'witchy book club', 'pumpkin season', 'cozy spooky', 'gothic autumn', 'october vibes'],
  },
}

const CHRISTMAS_DISCOVERY_PROFILE = {
  enabled: true,
  lanes: {
    motif: ['santa', 'candy cane', 'gingerbread', 'reindeer', 'nutcracker', 'christmas tree', 'snowman', 'ornament'],
    moment: ['christmas morning', 'ugly sweater party', 'cookie exchange', 'family christmas', 'office christmas party', 'secret santa', 'christmas vacation', 'first christmas'],
    audience: ['teacher', 'nurse', 'book lover', 'dog mom', 'cat mom', 'family', 'coworker', 'grandma'],
    aesthetic: ['retro', 'vintage', 'cozy', 'minimalist', 'coquette', 'western', 'embroidered', 'preppy'],
    adjacent: ['holiday reading', 'cozy christmas', 'christmas book club', 'winter wonderland', 'festive teacher', 'merry nurse', 'holiday baking', 'north pole crew'],
  },
}

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
    phrases: ['pumpkin', 'halloween', 'spooky', 'fall', 'autumn'],
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
    phrases: ['summer', 'beach', 'vacation'],
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
  'wall-art': {
    main: ['printable wall art composition'],
    supporting: ['room mockup safe margins'],
    productNote: 'wall-art-ready design, clear poster composition, readable at common print sizes',
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
    discoveryProfile: HALLOWEEN_DISCOVERY_PROFILE,
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
    seasonalSignals: ['santa', 'candy cane', 'gingerbread', 'reindeer', 'nutcracker', 'christmas tree', 'snowman', 'ornament', 'secret santa', 'winter wonderland', 'north pole'],
    discoveryProfile: CHRISTMAS_DISCOVERY_PROFILE,
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
  { id: 'wall-art', label: 'Wall Art', searchTerm: 'wall art', tags: ['wall art', 'art print', 'poster'] },
  { id: 'tote', label: 'Tote Bag', searchTerm: 'tote bag', tags: ['tote bag', 'canvas tote', 'gift tote'] },
  { id: 'sticker', label: 'Sticker', searchTerm: 'sticker', tags: ['sticker', 'laptop sticker', 'planner sticker'] },
]

export const DEFAULT_RISK_TERMS = [
  'disney',
  'disneyland',
  'disney world',
  'summerween',
  'mickey',
  'mickey mouse',
  'minnie',
  'minnie mouse',
  'donald duck',
  'pixar',
  'marvel',
  'avengers',
  'spiderman',
  'spider man',
  'deadpool',
  'star wars',
  'darth vader',
  'yoda',
  'baby yoda',
  'mandalorian',
  'lilo and stitch',
  'stitch',
  'elsa',
  'olaf',
  'moana',
  'encanto',
  'toy story',
  'winnie the pooh',
  'lion king',
  'harry potter',
  'pokemon',
  'nintendo',
  'mario',
  'zelda',
  'sonic',
  'minecraft',
  'roblox',
  'fortnite',
  'barbie',
  'bluey',
  'snoopy',
  'paw patrol',
  'sesame street',
  'minions',
  'spongebob',
  'sanrio',
  'hello kitty',
  'kuromi',
  'my melody',
  'grinch',
  'naruto',
  'one piece',
  'dragon ball',
  'goku',
  'vegeta',
  'demon slayer',
  'kimetsu',
  'jujutsu kaisen',
  'gojo',
  'my hero academia',
  'sailor moon',
  'studio ghibli',
  'ghibli',
  'totoro',
  'spy x family',
  'anya',
  'attack on titan',
  'chainsaw man',
  'death note',
  'evangelion',
  'lord of the rings',
  'lotr',
  'the hobbit',
  'hobbit',
  'tolkien',
  'scary movie',
  'scary movie 6',
  'fourth wing',
  'iron flame',
  'onyx storm',
  'acotar',
  'a court of thorns and roses',
  'bts',
  'bangtan',
  'bangtan boys',
  'bt21',
  'swiftie',
  'taylor swift',
  'super bowl',
  'nfl',
  'nba',
  'mlb',
  'fifa',
  'uefa',
  'champions league',
  'nhl',
  'carolina hurricanes',
  'cruz azul',
  'pumas unam',
  'pumas',
  'unam',
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
  'womens',
  'men',
  'mens',
  'kids',
  'adult',
  'for',
  'and',
  'the',
  'with',
  'from',
  'day',
  'holiday',
  'season',
])

const MONTH_AXIS_WORDS = new Set([
  'jan',
  'january',
  'feb',
  'february',
  'mar',
  'march',
  'apr',
  'april',
  'may',
  'jun',
  'june',
  'jul',
  'july',
  'aug',
  'august',
  'sep',
  'sept',
  'september',
  'oct',
  'october',
  'nov',
  'november',
  'dec',
  'december',
])

const PRODUCT_FAMILY_TERMS = {
  shirt: ['shirt', 'shirts', 'tshirt', 'tshirts', 'tee', 'tees', 'graphic tee'],
  sweatshirt: ['sweatshirt', 'sweatshirts', 'hoodie', 'hoodies', 'crewneck', 'crewnecks'],
  mug: ['mug', 'mugs', 'cup', 'cups', 'coffee mug'],
  tote: ['tote bag', 'tote', 'canvas tote', 'bag'],
  sticker: ['sticker', 'stickers', 'planner sticker', 'laptop sticker'],
  'wall-art': ['wall art', 'poster', 'posters', 'art print', 'prints', 'printable', 'nursery art'],
  digital: ['svg', 'png', 'template', 'digital download', 'planner', 'printable'],
}

const PRODUCT_TERM_TO_FAMILY = Object.entries(PRODUCT_FAMILY_TERMS).flatMap(([family, terms]) => (
  terms.map((term) => ({ family, term: normalizePhrase(term) }))
))

const CATEGORY_PRODUCT_FAMILY = {
  shirt: 'shirt',
  sweatshirt: 'sweatshirt',
  mug: 'mug',
  'wall-art': 'wall-art',
  tote: 'tote',
  sticker: 'sticker',
}

const BROAD_OCCASION_WORDS = new Set([
  'wedding',
  'birthday',
  'graduation',
  'christmas',
  'halloween',
  'easter',
  'thanksgiving',
  'holiday',
  'valentine',
  'valentines',
  'summer',
  'spring',
  'fall',
  'autumn',
  'winter',
  'party',
])

const STYLE_ONLY_WORDS = new Set([
  'funny',
  'custom',
  'personalized',
  'retro',
  'vintage',
  'cute',
  'embroidered',
  'western',
  'matching',
  'minimalist',
  'boho',
])

const UNSUPPORTED_SEARCH_TERMS = [
  'vs',
  'versus',
  'cruz azul',
  'pumas unam',
  'pumas',
  'unam',
  'carolina hurricanes',
  'lord of the rings',
  'lotr',
  'the hobbit',
  'club america',
  'chivas',
  'real madrid',
  'manchester united',
  'psg',
  'inter miami',
]

const CONTEXTUAL_UNSUPPORTED_SEARCH_TERMS = [
  'arsenal',
  'barcelona',
  'chelsea',
  'liverpool',
]

const TEAM_CONTEXT_TERMS = [
  'club',
  'fc',
  'football',
  'game',
  'jersey',
  'kit',
  'la liga',
  'logo',
  'match',
  'premier league',
  'shirt',
  'soccer',
  'team',
  'versus',
  'vs',
]

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
  etsySearches30d: ['etsy searches 30d', 'etsy searches', 'marketplace searches', '30 day searches', '30-day searches'],
  etsyListings: ['etsy listings', 'marketplace listings', 'etsy listing count'],
  etsyRelatedTerms: ['etsy related terms', 'marketplace related terms', 'related terms'],
  visibleListingCount: ['visible listing count', 'visible listings'],
  sellingListingCount: ['selling listing count', 'selling listings'],
  recentSellingListingCount: ['recent selling listing count', 'recent selling listings'],
  medianMonthlySales: ['median monthly sales', 'median sales'],
  medianMonthlyRevenue: ['median monthly revenue', 'median revenue'],
  totalVisibleMonthlySales: ['total visible monthly sales', 'visible monthly sales total'],
  topSalesShare: ['top sales share', 'top listing sales share'],
  medianListingAgeMonths: ['median listing age months', 'median listing age'],
  productRows: ['everbee product rows json', 'product rows json', 'everbee product rows'],
  crossNicheParent: ['cross niche parent', 'cross-niche parent', 'parent keyword'],
  crossNicheDepth: ['cross niche depth', 'cross-niche depth', 'drilldown depth'],
  intentTrack: ['market track', 'intent track', 'event market track'],
  researchEventId: ['research event', 'research event id', 'event id'],
  researchCategoryId: ['research category', 'research category id', 'category id'],
  historyClusterKey: ['history cluster', 'history cluster key', 'market cluster'],
  erankCheckedAt: ['erank checked at', 'erank captured at'],
  etsyCheckedAt: ['etsy checked at', 'etsy captured at', 'marketplace checked at'],
  everbeeCheckedAt: ['everbee checked at', 'everbee captured at'],
  expectedOpportunity: ['expected opportunity'],
  expectedConfidence: ['expected confidence'],
  sourceKeyword: ['source keyword', 'erank source keyword', 'source', '派生元'],
  sourceKeywords: ['erank source keywords json', 'source keywords json', 'source keywords'],
  query: ['erank query'],
  queryKind: ['erank query kind', 'query kind'],
  erankCaptureStatus: ['erank capture status', 'capture status'],
  erankAttemptedAt: ['erank attempted at', 'erank searched at'],
  researchRoundId: ['research round', 'research round id'],
  researchRoundType: ['round type', 'research round type'],
  researchRoundDepth: ['round depth', 'research round depth'],
  researchRoundStatus: ['round status', 'research round status', 'research status'],
  buyerIntentAxes: ['buyer intent axes json', 'buyer intent axes'],
  wearerIntent: ['wearer intent', 'buyer intent mode'],
  recipientRole: ['recipient role', 'recipient'],
  giverRole: ['giver role', 'giver'],
  occasion: ['occasion', 'gift occasion'],
  personalization: ['personalization', 'personalization type'],
  roundACount: ['round a count'],
  roundBCount: ['round b count'],
  roundCCount: ['round c count'],
  roundDCount: ['round d count'],
  roundStartReason: ['round start reason'],
  roundStopReason: ['round stop reason'],
  notes: ['notes', 'note', 'memo', 'メモ'],
}

const BROAD_LISTING_FIELD_ALIASES = {
  title: ['title', 'product title', 'product name', 'listing title', 'name', '商品名', 'タイトル'],
  tags: ['tags', 'tag', 'etsy tags', 'tag words', 'タグ'],
  sales: ['sales', 'monthly sales', 'estimated sales', 'est sales', 'top monthly sales', '販売数', '月間販売数'],
  totalSales: ['total sales', 'lifetime sales', '累計販売数'],
  revenue: ['revenue', 'monthly revenue', 'estimated revenue', '売上', '収益'],
  listingAgeMonths: ['listing age months', 'listing age', 'age months', '公開後月数'],
  price: ['price', 'estimated price', '価格'],
  shopName: ['shop name', 'shop', 'store name', 'ショップ名'],
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

const EVENT_DAY_BY_ID = {
  'new-years-day': 1,
  'valentines-day': 14,
  'st-patricks-day': 17,
  'earth-day': 22,
  'national-pet-day': 11,
  'fathers-day': 21,
  'canada-day': 1,
  'independence-day': 4,
  halloween: 31,
  'veterans-day': 11,
  christmas: 25,
  'new-years-eve': 31,
}

const CLUSTER_IGNORED_TOKENS = new Set([
  'shirt',
  'shirts',
  'tshirt',
  'tshirts',
  'tee',
  'tees',
  'sweatshirt',
  'sweatshirts',
  'crewneck',
  'crewnecks',
  'hoodie',
  'hoodies',
  'graphic',
  'retro',
  'vintage',
  'funny',
  'cute',
  'minimalist',
  'boho',
  'western',
  'embroidered',
  'personalized',
  'custom',
  'gift',
  'gifts',
])

function parseDate(value) {
  if (!value) return null
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function getSourceFreshness(capturedAt, now = new Date()) {
  const capturedDate = parseDate(capturedAt)
  const nowDate = parseDate(now)
  if (!capturedDate || !nowDate) {
    return {
      capturedAt: capturedDate?.toISOString() ?? null,
      freshnessDays: null,
      freshnessLabel: 'unavailable',
      eligibleForRanking: false,
    }
  }

  const freshnessDays = Math.max(0, Math.floor((nowDate.getTime() - capturedDate.getTime()) / 86400000))
  const freshnessLabel = freshnessDays <= 30
    ? 'fresh'
    : freshnessDays <= 45
      ? 'usable'
      : freshnessDays <= 90
        ? 'inspiration'
        : 'expired'

  return {
    capturedAt: capturedDate.toISOString(),
    freshnessDays,
    freshnessLabel,
    eligibleForRanking: freshnessDays <= 45,
  }
}

export function getMarketplaceInsightFreshness(capturedAt, now = new Date()) {
  const freshness = getSourceFreshness(capturedAt, now)
  if (freshness.freshnessDays === null) return freshness

  return {
    ...freshness,
    freshnessLabel: freshness.freshnessDays <= 7
      ? 'fresh'
      : freshness.freshnessDays <= 30
        ? 'inspiration'
        : 'expired',
    eligibleForRanking: freshness.freshnessDays <= 7,
  }
}

export function getMarketTiming(event = {}, now = new Date()) {
  const nowDate = parseDate(now)
  const month = Number(event.month)
  if (!nowDate || event.id === 'auto-discovery' || !Number.isInteger(month) || month < 1 || month > 12) {
    return { label: 'evergreen', weeksUntil: null, priority: 2 }
  }

  const day = EVENT_DAY_BY_ID[event.id] ?? 15
  let eventDate = new Date(Date.UTC(nowDate.getUTCFullYear(), month - 1, day))
  if (eventDate.getTime() < nowDate.getTime()) {
    eventDate = new Date(Date.UTC(nowDate.getUTCFullYear() + 1, month - 1, day))
  }
  const weeksUntil = Math.max(0, Math.round((eventDate.getTime() - nowDate.getTime()) / (7 * 86400000)))

  if (weeksUntil >= 10 && weeksUntil <= 16) return { label: 'prepare', weeksUntil, priority: 4 }
  if (weeksUntil >= 4 && weeksUntil < 10) return { label: 'launch', weeksUntil, priority: 5 }
  if (weeksUntil < 4) return { label: 'late', weeksUntil, priority: 1 }
  return { label: 'next-cycle', weeksUntil, priority: 2 }
}

export function buildKeywordClusterKey(keyword, options = {}) {
  const category = PRODUCT_CATEGORIES.find((item) => item.id === options.categoryId)
  const ignored = new Set(CLUSTER_IGNORED_TOKENS)
  for (const value of [category?.searchTerm, ...(category?.tags ?? [])]) {
    normalizePhrase(value).split(' ').filter(Boolean).forEach((token) => ignored.add(token))
  }

  const tokens = normalizePhrase(keyword)
    .split(' ')
    .filter((token) => token && !ignored.has(token))
  return unique(tokens).join(' ') || normalizePhrase(keyword)
}

export function clusterKeywordCandidates(candidates = [], options = {}) {
  const clusters = new Map()
  for (const candidate of candidates) {
    const clusterKey = buildKeywordClusterKey(candidate?.keyword, options)
    if (!clusterKey) continue
    const members = clusters.get(clusterKey) ?? []
    members.push(candidate)
    clusters.set(clusterKey, members)
  }

  return Array.from(clusters.entries())
    .map(([clusterKey, members]) => {
      const sorted = [...members].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
      return {
        ...sorted[0],
        clusterKey,
        clusterSize: members.length,
        clusterKeywords: members.map((member) => normalizePhrase(member.keyword)),
      }
    })
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || a.keyword.localeCompare(b.keyword, 'en'))
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

export function getBroadEventDiscoveryProfile(options = {}) {
  const event = getEvent(options)
  const profile = event.discoveryProfile
  if (!profile?.enabled || !profile.lanes) {
    return { enabled: false, lanes: {} }
  }

  return {
    enabled: true,
    lanes: Object.fromEntries(
      Object.entries(profile.lanes).map(([lane, terms]) => [lane, unique(terms.map((term) => normalizePhrase(term)))]),
    ),
  }
}

function countWords(value) {
  return normalizePhrase(value).split(' ').filter(Boolean).length
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function phraseHasTerm(phrase, term) {
  const normalizedPhrase = normalizePhrase(phrase)
  const normalizedTerm = normalizePhrase(term)
  if (!normalizedPhrase || !normalizedTerm) return false
  return new RegExp(`(?:^|\\s)${escapeRegExp(normalizedTerm)}(?:\\s|$)`).test(normalizedPhrase)
}

function keywordProductFamilies(keyword) {
  const normalized = normalizePhrase(keyword)
  return unique(PRODUCT_TERM_TO_FAMILY
    .filter(({ term }) => phraseHasTerm(normalized, term))
    .map(({ family }) => family))
}

export function keywordMatchesCategoryProduct(keyword, categoryId) {
  const category = getCategory(categoryId)
  return keywordProductFamilies(keyword).includes(CATEGORY_PRODUCT_FAMILY[category.id])
}

function isYearishToken(token) {
  return /^(?:20\d{2}|\d{2})$/.test(token)
}

function hasMeaningfulYearPattern(keyword) {
  const normalized = normalizePhrase(keyword)
  return /\b(?:est|established|class of|senior|graduate|graduation|grad|new mom|new dad|mom to be|dad to be|bride|groom)\b/.test(normalized)
}

function singularToken(token) {
  if (token.length <= 3 || token.endsWith('ss')) return token
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`
  if (token.endsWith('es') && /(ches|shes|xes|zes|ses)$/.test(token)) return token.slice(0, -2)
  if (token.endsWith('s')) return token.slice(0, -1)
  return token
}

function tokenVariants(token) {
  return unique([token, singularToken(token)].filter(Boolean))
}

const compiledTermCache = new WeakMap()
const customRiskTermCache = new Map()

function compileTerms(terms) {
  return unique(terms)
    .map((term) => normalizePhrase(term))
    .filter((term) => term.length >= 2)
    .map((term) => ({
      term,
      tokenVariants: phraseTokens(term).map((token) => new Set(tokenVariants(token))),
    }))
}

function compiledTerms(terms) {
  if (!Array.isArray(terms)) return compileTerms([])
  const cached = compiledTermCache.get(terms)
  if (cached) return cached

  const compiled = compileTerms(terms)
  compiledTermCache.set(terms, compiled)
  return compiled
}

function phraseMatchesCompiled(sourceVariants, termVariants) {
  if (termVariants.length === 0 || termVariants.length > sourceVariants.length) return false

  for (let index = 0; index <= sourceVariants.length - termVariants.length; index += 1) {
    const matches = termVariants.every((variants, offset) => (
      sourceVariants[index + offset].some((variant) => variants.has(variant))
    ))
    if (matches) return true
  }

  return false
}

function detectCompiledTerms(value, terms) {
  const sourceVariants = phraseTokens(value).map(tokenVariants)
  return terms
    .filter(({ tokenVariants: termVariants }) => phraseMatchesCompiled(sourceVariants, termVariants))
    .map(({ term }) => term)
}

function detectTerms(value, terms) {
  return detectCompiledTerms(value, compiledTerms(terms))
}

function compiledCustomRiskTerms(terms) {
  const normalized = unique(terms)
    .map((term) => normalizePhrase(term))
    .filter((term) => term.length >= 2)
  if (normalized.length === 0) return []

  const key = normalized.join('\u0000')
  const cached = customRiskTermCache.get(key)
  if (cached) return cached

  const compiled = compileTerms(normalized)
  if (customRiskTermCache.size >= 32) customRiskTermCache.clear()
  customRiskTermCache.set(key, compiled)
  return compiled
}

export function detectUnsupportedSearchTerms(value) {
  const hardTerms = detectTerms(value, UNSUPPORTED_SEARCH_TERMS)
  const hasTeamContext = detectTerms(value, TEAM_CONTEXT_TERMS).length > 0
  const contextualTerms = hasTeamContext
    ? detectTerms(value, CONTEXTUAL_UNSUPPORTED_SEARCH_TERMS)
    : []
  return unique([...hardTerms, ...contextualTerms])
}

function candidateSpecificTokens(keyword, options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const eventTokens = phraseTokens(event.searchTerm)
  const categoryTokens = [
    category.searchTerm,
    ...(category.tags ?? []),
  ].flatMap(phraseTokens)
  const stopWords = new Set([
    ...GENERIC_WORDS,
    ...MONTH_AXIS_WORDS,
    ...STYLE_ONLY_WORDS,
    ...BROAD_OCCASION_WORDS,
    ...eventTokens,
    ...categoryTokens,
  ])

  return phraseTokens(keyword)
    .filter((token) => !stopWords.has(token))
    .filter((token) => !isYearishToken(token))
    .filter((token) => token.length >= 2)
}

export function classifyCandidateKeyword(keyword, options = {}) {
  const normalized = normalizePhrase(keyword)
  const tokens = phraseTokens(normalized)
  if (tokens.length === 0) {
    return { action: 'reject', label: '除外', reason: 'キーワードが空です', specificTokens: [] }
  }

  const specificTokens = candidateSpecificTokens(normalized, options)
  const unsupportedSearchTerms = detectUnsupportedSearchTerms(normalized)
  if (unsupportedSearchTerms.length > 0) {
    return {
      action: 'reject',
      label: 'Unsupported name',
      reason: `人名・チーム名・対戦名など検索しても使いにくい語句を含みます: ${unsupportedSearchTerms.join(', ')}`,
      specificTokens,
      unsupportedSearchTerms,
    }
  }

  const hasMonthAxis = tokens.some((token) => MONTH_AXIS_WORDS.has(token))
  const hasYearish = tokens.some(isYearishToken)
  if (hasMonthAxis && hasYearish && !hasMeaningfulYearPattern(normalized)) {
    return {
      action: 'reject',
      label: '日付ノイズ',
      reason: 'グラフや表の日付軸に見えるため候補から除外します',
      specificTokens,
    }
  }

  const category = getCategory(options.categoryId)
  const expectedFamily = CATEGORY_PRODUCT_FAMILY[category.id]
  const families = keywordProductFamilies(normalized)
  const mismatchedFamilies = expectedFamily
    ? families.filter((family) => family !== expectedFamily)
    : []
  if (mismatchedFamilies.length > 0) {
    return {
      action: 'reject',
      label: '商品違い',
      reason: '選択中の商品カテゴリと違う商品語が入っています',
      specificTokens,
      families,
    }
  }

  if (expectedFamily && !families.includes(expectedFamily)) {
    return {
      action: 'explore',
      label: '入口ワード',
      reason: '選択中の商品語がないため、関連語探索用にします',
      specificTokens,
      families,
    }
  }

  if (isGenericCandidateKeyword(normalized)) {
    return {
      action: 'explore',
      label: '入口ワード',
      reason: '商品名やgiftだけで広すぎるため、関連語探索用にします',
      specificTokens,
      families,
    }
  }

  if (specificTokens.length === 0) {
    return {
      action: 'explore',
      label: '入口ワード',
      reason: 'イベント・商品・スタイルだけで広すぎるため、関連語探索用にします',
      specificTokens,
      families,
    }
  }

  return {
    action: 'candidate',
    label: '調査候補',
    reason: '買い手・用途・趣味・モチーフなどの具体語があります',
    specificTokens,
    families,
  }
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

function hasDuplicateGarmentProductTerms(value) {
  const keyword = normalizePhrase(value)
  const shirtTerms = keyword.match(/\b(?:graphic tee|tshirts?|shirts?|tees?)\b/g) ?? []
  const sweatshirtTerms = keyword.match(/\b(?:sweatshirts?|hoodies?|crewnecks?)\b/g) ?? []
  return shirtTerms.length > 1 || sweatshirtTerms.length > 1
}

function hasConflictingRecipientRoles(value) {
  const keyword = normalizePhrase(value)
  if (/\b(?:matching|family|couples?|parents|grandparents)\b/.test(keyword)) return false

  return [
    ['mom', 'dad'],
    ['mother', 'father'],
    ['mama', 'papa'],
    ['grandma', 'grandpa'],
    ['bride', 'groom'],
  ].some(([left, right]) => phraseHasTerm(keyword, left) && phraseHasTerm(keyword, right))
}

export function detectRiskTerms(value, customRiskTerms = []) {
  return unique([
    ...detectTerms(value, DEFAULT_RISK_TERMS),
    ...detectCompiledTerms(value, compiledCustomRiskTerms(customRiskTerms)),
  ])
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
  const recipientTerms = AUTO_DISCOVERY_SEGMENTS.recipients.map((term) => normalizePhrase(term))
  const templates = []

  for (const target of targets) {
    templates.push(`${target} ${product}`)
    if (eventTerm) {
      templates.push(`${target} ${eventTerm} ${product}`)
      if (year) templates.push(`${target} ${eventTerm} ${product} ${year}`)
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
    const hasProductTerm = keywordProductFamilies(normalizedSeed).includes(CATEGORY_PRODUCT_FAMILY[category.id])
    const hasRecipientTerm = recipientTerms.some((term) => phraseHasTerm(normalizedSeed, term))

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
      const normalizedTarget = normalizePhrase(target)
      if (normalizedSeed.includes(normalizedTarget)) continue
      if (hasRecipientTerm && recipientTerms.includes(normalizedTarget)) continue
      templates.push(hasProductTerm ? `${target} ${normalizedSeed}` : `${target} ${normalizedSeed} ${product}`)
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
  ]).filter((intent) => options.includeGiftIntent === true || !/\bgift\b/.test(normalizePhrase(intent)))

  const keywords = unique(
    buildKeywordTemplates(event, category, discoveryTargets, intents, seedKeywords, year)
      .map((keyword) => normalizePhrase(keyword))
      .filter((keyword) => countWords(keyword) >= 2)
      .filter((keyword) => classifyCandidateKeyword(keyword, options).action === 'candidate')
      .filter((keyword) => !hasRepeatedAdjacentPhrase(keyword))
      .filter((keyword) => !hasDuplicateGarmentProductTerms(keyword))
      .filter((keyword) => !hasConflictingRecipientRoles(keyword))
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

const BROAD_EVENT_LANE_ORDER = ['motif', 'moment', 'audience', 'aesthetic', 'adjacent']

function broadEventCoreTerm(lane, term, index, profile) {
  const motifTerms = profile.lanes.motif ?? []
  const motif = motifTerms[index % Math.max(1, motifTerms.length)] ?? 'seasonal'

  if (lane === 'audience') return `${motif} ${term}`
  if (lane === 'aesthetic') return `${term} ${motif}`
  return term
}

function inferBroadEventLane(term, profile) {
  const normalized = normalizePhrase(term)
  for (const lane of BROAD_EVENT_LANE_ORDER) {
    if ((profile.lanes[lane] ?? []).some((axisTerm) => normalizePhrase(axisTerm) === normalized)) return lane
  }
  for (const lane of BROAD_EVENT_LANE_ORDER) {
    if ((profile.lanes[lane] ?? []).some((axisTerm) => phraseHasTerm(normalized, axisTerm))) return lane
  }
  return 'adjacent'
}

function buildBroadEventCandidate(keyword, metadata, event, category, customRiskTerms, options) {
  const normalized = normalizePhrase(keyword)
  if (countWords(normalized) < 2) return null
  if (classifyCandidateKeyword(normalized, options).action !== 'candidate') return null
  if (hasRepeatedAdjacentPhrase(normalized)) return null
  if (hasDuplicateGarmentProductTerms(normalized)) return null
  if (hasConflictingRecipientRoles(normalized)) return null

  const riskTerms = detectRiskTerms(normalized, customRiskTerms)
  const eventTerm = normalizePhrase(event.searchTerm)
  return {
    keyword: normalized,
    eventId: event.id,
    eventLabel: event.jpLabel,
    categoryId: category.id,
    categoryLabel: category.label,
    score: scoreCandidateKeyword(normalized, customRiskTerms),
    wordCount: countWords(normalized),
    riskTerms,
    status: riskTerms.length > 0 ? 'review' : 'ready',
    discoveryLane: metadata.discoveryLane,
    queryStrategy: metadata.queryStrategy,
    axisTerms: unique(metadata.axisTerms ?? []),
    containsEventTerm: Boolean(eventTerm && phraseHasTerm(normalized, eventTerm)),
  }
}

export function generateBroadEventCandidates(options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const profile = getBroadEventDiscoveryProfile(options)
  if (!profile.enabled) return generateKeywordCandidates(options)

  const limit = Math.max(10, Math.min(Number(options.limit) || 40, 80))
  const product = normalizePhrase(category.searchTerm)
  const eventTerm = normalizePhrase(event.searchTerm)
  const customRiskTerms = splitSeedText(options.customRiskTerms)
  const observedTerms = unique(splitSeedText(options.observedTerms ?? options.seedKeywords))
  const observedByLane = Object.fromEntries(BROAD_EVENT_LANE_ORDER.map((lane) => [lane, []]))

  for (const observedTerm of observedTerms) {
    const lane = inferBroadEventLane(observedTerm, profile)
    observedByLane[lane].push(observedTerm)
  }

  const laneBuckets = BROAD_EVENT_LANE_ORDER.map((lane) => {
    const terms = profile.lanes[lane] ?? []
    const rows = []

    for (let index = 0; index < terms.length; index += 1) {
      const axisTerm = terms[index]
      const core = broadEventCoreTerm(lane, axisTerm, index, profile)
      const queryStrategy = index < 2 ? 'direct' : 'adjacent'
      const keyword = queryStrategy === 'direct'
        ? `${phraseHasTerm(core, eventTerm) ? core : `${eventTerm} ${core}`} ${product}`
        : `${core} ${product}`
      const candidate = buildBroadEventCandidate(keyword, {
        discoveryLane: lane,
        queryStrategy,
        axisTerms: [axisTerm],
      }, event, category, customRiskTerms, options)
      if (candidate) rows.push(candidate)
    }

    for (const observedTerm of observedByLane[lane].slice(0, 2)) {
      const hasProduct = keywordProductFamilies(observedTerm).includes(CATEGORY_PRODUCT_FAMILY[category.id])
      const keyword = hasProduct ? observedTerm : `${observedTerm} ${product}`
      const candidate = buildBroadEventCandidate(keyword, {
        discoveryLane: lane,
        queryStrategy: 'observed',
        axisTerms: [observedTerm],
      }, event, category, customRiskTerms, options)
      if (!candidate) continue
      const replaceAt = rows.findLastIndex((row) => row.queryStrategy === 'adjacent')
      if (replaceAt >= 0) rows.splice(replaceAt, 1, candidate)
    }

    return rows.slice(0, 8)
  })

  const balanced = []
  for (let index = 0; index < 8; index += 1) {
    for (const bucket of laneBuckets) {
      if (bucket[index]) balanced.push(bucket[index])
    }
  }

  const seen = new Set()
  return balanced
    .filter((row) => {
      if (seen.has(row.keyword)) return false
      seen.add(row.keyword)
      return true
    })
    .slice(0, limit)
}

function marketplaceInsightConversionScore(value) {
  const label = String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (/very high|very-high|とても高い|非常に高い/.test(label)) {
    return { level: 'very-high', points: 20, label }
  }
  if (/very low|very-low|とても低い|非常に低い/.test(label)) {
    return { level: 'very-low', points: 0, label }
  }
  if (/high|高い/.test(label)) return { level: 'high', points: 16, label }
  if (/medium|average|普通|中程度/.test(label)) return { level: 'medium', points: 11, label }
  if (/low|低い/.test(label)) return { level: 'low', points: 5, label }
  return { level: 'unknown', points: 8, label }
}

function normalizeMarketplaceMetric(metric = {}) {
  const keyword = normalizePhrase(metric.keyword ?? metric.query)
  const sourceQueries = unique([
    ...(Array.isArray(metric.sourceQueries) ? metric.sourceQueries : []),
    metric.sourceQuery,
  ].map(normalizePhrase).filter(Boolean))
  const sourceModes = unique([
    ...(Array.isArray(metric.sourceModes) ? metric.sourceModes : []),
    metric.sourceMode,
  ].map(normalizePhrase).filter(Boolean))
  return {
    ...metric,
    keyword,
    etsySearches30d: parseNumber(metric.etsySearches30d),
    etsyListings: parseNumber(metric.etsyListings),
    conversionLabel: String(metric.conversionLabel ?? '').replace(/\s+/g, ' ').trim(),
    sourceQuery: sourceQueries[0] ?? '',
    sourceQueries,
    sourceCount: sourceQueries.length,
    sourceMode: sourceModes[0] ?? '',
    sourceModes,
    sourceModeCount: sourceModes.length,
  }
}

export function mergeMarketplaceInsightRelatedMetrics(existing = [], incoming = [], options = {}) {
  const merged = new Map()
  for (const rawMetric of [...existing, ...incoming]) {
    const metric = normalizeMarketplaceMetric(rawMetric)
    if (!metric.keyword) continue
    const previous = merged.get(metric.keyword)
    if (!previous) {
      merged.set(metric.keyword, metric)
      continue
    }

    const sourceQueries = unique([...previous.sourceQueries, ...metric.sourceQueries])
    const sourceModes = unique([...previous.sourceModes, ...metric.sourceModes])
    merged.set(metric.keyword, {
      ...previous,
      ...metric,
      etsySearches30d: metric.etsySearches30d ?? previous.etsySearches30d,
      etsyListings: metric.etsyListings ?? previous.etsyListings,
      conversionLabel: metric.conversionLabel || previous.conversionLabel,
      sourceQuery: sourceQueries[0] ?? '',
      sourceQueries,
      sourceCount: sourceQueries.length,
      sourceMode: sourceModes[0] ?? '',
      sourceModes,
      sourceModeCount: sourceModes.length,
    })
  }

  const limit = Math.max(1, Math.min(Number(options.limit) || 500, 1000))
  return Array.from(merged.values()).slice(0, limit)
}

function marketplaceInsightClusterKey(keyword, options = {}) {
  const tokens = buildKeywordClusterKey(keyword, options)
    .split(' ')
    .map(singularToken)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'))
  return unique(tokens).join(' ') || normalizePhrase(keyword)
}

export function rankMarketplaceInsightRelatedCandidates(metrics = [], options = {}) {
  const category = getCategory(options.categoryId)
  const customRiskTerms = splitSeedText(options.customRiskTerms)
  const poolLimit = Math.max(20, Math.min(Number(options.candidatePoolLimit) || 200, 500))
  const merged = mergeMarketplaceInsightRelatedMetrics([], metrics)

  return merged
    .map((metric) => {
      const query = normalizePhrase(metric.keyword)
      const searches = metric.etsySearches30d
      const listings = metric.etsyListings
      if (!query || !Number.isFinite(searches) || searches <= 0 || !Number.isFinite(listings) || listings <= 0) return null
      if (!keywordMatchesCategoryProduct(query, category.id)) return null
      if (classifyCandidateKeyword(query, options).action === 'reject') return null
      if (detectRiskTerms(query, customRiskTerms).length > 0) return null

      const conversion = marketplaceInsightConversionScore(metric.conversionLabel)
      const wordCount = countWords(query)
      const demand = Math.min(25, (Math.log10(searches + 1) / 4) * 25)
      const supplyOpportunity = Math.min(25, Math.log10(1 + ((searches / listings) * 1000)) * 12.5)
      const productMatch = 10
      const specificity = wordCount >= 3 && wordCount <= 6
        ? 10
        : wordCount === 2 || wordCount === 7
          ? 5
          : 2
      const recurrence = Math.min(10, Math.max(1, metric.sourceCount) * 5)
      const scoreBreakdown = {
        demand: Math.round(demand * 10) / 10,
        supplyOpportunity: Math.round(supplyOpportunity * 10) / 10,
        conversion: conversion.points,
        productMatch,
        specificity,
        recurrence,
      }
      const score = Math.round(Object.values(scoreBreakdown).reduce((sum, points) => sum + points, 0) * 10) / 10
      const repeatedVeryLowOpportunity = conversion.level === 'very-low'
        && metric.sourceCount >= 2
        && supplyOpportunity >= 10
      const scarceVeryLowOpportunity = conversion.level === 'very-low'
        && searches >= Math.max(1, Number(options.veryLowScarcityMinSearches) || 20)
        && listings <= Math.max(1, Number(options.veryLowScarcityMaxListings) || 500)
        && supplyOpportunity >= 18
      const eligibleForFollowUp = score >= 35
        && (conversion.level !== 'very-low' || repeatedVeryLowOpportunity || scarceVeryLowOpportunity)
      const selectionReasons = [
        `Search ${searches}`,
        `Listings ${listings}`,
        conversion.level !== 'unknown' ? `Conversion ${conversion.level}` : '',
        metric.sourceCount >= 2 ? `Found from ${metric.sourceCount} seeds` : '',
        metric.sourceModeCount >= 2 ? 'Found in both Etsy views' : '',
        scarceVeryLowOpportunity ? 'Scarce supply signal' : '',
        wordCount >= 3 && wordCount <= 6 ? `${wordCount} words` : '',
      ].filter(Boolean)

      return {
        ...metric,
        query,
        keyword: query,
        clusterKey: marketplaceInsightClusterKey(query, options),
        wordCount,
        conversionLevel: conversion.level,
        score,
        opportunityIndex: score,
        scoreBreakdown,
        selectionReasons,
        scarceVeryLowOpportunity,
        eligibleForFollowUp,
      }
    })
    .filter(Boolean)
    .sort((left, right) => (
      right.score - left.score
      || right.sourceCount - left.sourceCount
      || right.etsySearches30d - left.etsySearches30d
      || left.etsyListings - right.etsyListings
      || left.query.localeCompare(right.query, 'en')
    ))
    .slice(0, poolLimit)
}

export function selectMarketplaceInsightFollowUpBatch(pool = [], existingQueries = [], options = {}) {
  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || 5, 20))
  const maxPerCluster = Math.max(1, Math.min(Number(options.maxPerCluster) || 2, batchSize))
  const used = new Set(existingQueries.map((item) => normalizePhrase(item?.query ?? item)).filter(Boolean))
  const selected = []
  const clusterCounts = new Map()
  const sourceCounts = new Map()

  function trySelect(candidate, enforceSourceDiversity) {
    const query = normalizePhrase(candidate?.query ?? candidate?.keyword)
    if (!query || used.has(query) || candidate?.eligibleForFollowUp === false) return false
    const clusterKey = normalizePhrase(candidate.clusterKey) || query
    if ((clusterCounts.get(clusterKey) ?? 0) >= maxPerCluster) return false
    const sourceKey = normalizePhrase(candidate.sourceQueries?.[0] ?? candidate.sourceQuery)
    if (enforceSourceDiversity && sourceKey && (sourceCounts.get(sourceKey) ?? 0) >= 2) return false

    selected.push(candidate)
    used.add(query)
    clusterCounts.set(clusterKey, (clusterCounts.get(clusterKey) ?? 0) + 1)
    if (sourceKey) sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1)
    return true
  }

  for (const candidate of pool) {
    trySelect(candidate, true)
    if (selected.length >= batchSize) return selected
  }
  for (const candidate of pool) {
    trySelect(candidate, false)
    if (selected.length >= batchSize) break
  }
  return selected
}

export function evaluateMarketplaceInsightResearchStop(state = {}) {
  const completedFollowUpCount = Math.max(0, Number(state.completedFollowUpCount) || 0)
  const stagnantRounds = Math.max(0, Number(state.stagnantRounds) || 0)
  const remainingCandidateCount = Math.max(0, Number(state.remainingCandidateCount) || 0)
  if (completedFollowUpCount >= 40) return { shouldStop: true, reason: 'max-followups' }
  if (remainingCandidateCount < 5) return { shouldStop: true, reason: 'candidate-pool-depleted' }
  if (completedFollowUpCount >= 20 && stagnantRounds >= 2) return { shouldStop: true, reason: 'stagnant' }
  return { shouldStop: false, reason: '' }
}

export function advanceMarketplaceInsightResearch(plan = {}, options = {}) {
  const sourceItems = Array.isArray(plan.items) ? plan.items : []
  const items = sourceItems.map((item) => ({ ...item }))
  const seedItems = items.filter((item) => item.stage !== 'followup')
  const followUpItems = items.filter((item) => item.stage === 'followup')
  const completedSeedCount = seedItems.filter((item) => item.status === 'completed').length
  const completedFollowUpCount = followUpItems.filter((item) => item.status === 'completed' || item.status === 'skipped').length
  const activeFollowUps = followUpItems.filter((item) => ['planned', 'opened', 'error'].includes(item.status))
  const existingQueries = items.map((item) => item.query)
  const existingKeys = new Set(existingQueries.map(normalizePhrase).filter(Boolean))
  const candidatePool = Array.isArray(plan.candidatePool) ? plan.candidatePool : []
  const remainingCandidates = candidatePool.filter((candidate) => (
    candidate.eligibleForFollowUp !== false
    && !existingKeys.has(normalizePhrase(candidate.query ?? candidate.keyword))
  ))

  let stagnantRounds = Math.max(0, Number(plan.stagnantRounds) || 0)
  let lastEvaluatedRound = Math.max(0, Number(plan.lastEvaluatedRound) || 0)
  const researchRound = Math.max(0, Number(plan.researchRound) || 0)
  if (researchRound > lastEvaluatedRound && activeFollowUps.length === 0) {
    const baselineClusters = new Set(Array.isArray(plan.roundBaselineClusterKeys) ? plan.roundBaselineClusterKeys : [])
    const newClusterCount = remainingCandidates.filter((candidate) => !baselineClusters.has(candidate.clusterKey)).length
    stagnantRounds = newClusterCount > 0 ? 0 : stagnantRounds + 1
    lastEvaluatedRound = researchRound
  }

  const nextPlan = {
    ...plan,
    items,
    candidatePool,
    completedSeedCount,
    completedFollowUpCount,
    releasedFollowUpCount: followUpItems.length,
    stagnantRounds,
    lastEvaluatedRound,
  }

  if (activeFollowUps.length > 0) return { plan: nextPlan, addedCount: 0, reason: 'batch-in-progress' }
  if (completedSeedCount < 10) return { plan: nextPlan, addedCount: 0, reason: 'need-more-seeds' }
  if (followUpItems.length > 0 && completedSeedCount < (Number(plan.seedQuota) || 20)) {
    return { plan: nextPlan, addedCount: 0, reason: 'continue-seeds' }
  }

  const stop = evaluateMarketplaceInsightResearchStop({
    completedFollowUpCount,
    stagnantRounds,
    remainingCandidateCount: remainingCandidates.length,
  })
  if (stop.shouldStop) {
    return {
      plan: { ...nextPlan, stopReason: stop.reason },
      addedCount: 0,
      reason: stop.reason,
    }
  }

  const batchSize = Number(plan.followUpBatchSize) || 5
  const batch = selectMarketplaceInsightFollowUpBatch(candidatePool, existingQueries, {
    batchSize,
    maxPerCluster: 2,
  })
  if (batch.length < batchSize) {
    return {
      plan: { ...nextPlan, stopReason: 'candidate-pool-depleted' },
      addedCount: 0,
      reason: 'candidate-pool-depleted',
    }
  }

  const followUpRows = batch.map((candidate, index) => ({
    id: `etsy-insight-followup-${followUpItems.length + index + 1}`,
    query: normalizePhrase(candidate.query ?? candidate.keyword),
    stage: 'followup',
    status: 'planned',
    discoveryLane: candidate.discoveryLane ?? 'adjacent',
    queryStrategy: 'observed',
    axisTerms: [],
    clusterKey: candidate.clusterKey,
    reason: `Etsy関連候補 ${candidate.score}点`,
    sourceQuery: normalizePhrase(candidate.sourceQueries?.[0] ?? candidate.sourceQuery),
    sourceQueries: Array.isArray(candidate.sourceQueries) ? [...candidate.sourceQueries] : [],
    etsySearches30d: candidate.etsySearches30d,
    etsyListings: candidate.etsyListings,
    conversionLabel: candidate.conversionLabel,
    opportunityIndex: candidate.score,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
    selectionReasons: candidate.selectionReasons,
  }))
  const insertIndex = items.findIndex((item) => ['planned', 'opened', 'error'].includes(item.status))
  const nextItems = insertIndex >= 0
    ? [...items.slice(0, insertIndex), ...followUpRows, ...items.slice(insertIndex)]
    : [...items, ...followUpRows]
  const nextRound = researchRound + 1
  return {
    plan: {
      ...nextPlan,
      items: nextItems.map((item, index) => ({ ...item, id: `etsy-insight-${index + 1}` })),
      researchRound: nextRound,
      releasedFollowUpCount: followUpItems.length + followUpRows.length,
      followUpRemaining: Math.max(0, (Number(plan.followUpCapacity) || 40) - followUpItems.length - followUpRows.length),
      roundBaselineClusterKeys: unique(candidatePool
        .filter((candidate) => candidate.eligibleForFollowUp !== false)
        .map((candidate) => candidate.clusterKey)
        .filter(Boolean)),
      stopReason: '',
    },
    addedCount: followUpRows.length,
    reason: 'batch-added',
  }
}

export function buildMarketplaceInsightPlan(candidates = [], options = {}) {
  const event = getEvent(options)
  const category = getCategory(options.categoryId)
  const mode = options.marketplaceInsightMode === 'plus' ? 'plus' : 'free'
  const config = mode === 'plus'
    ? { quota: 60, seedQuota: 20, discovery: 6, validation: 11, reserve: 3 }
    : { quota: 15, seedQuota: 15, discovery: 5, validation: 7, reserve: 3 }
  const baselineQuery = normalizePhrase(`${event.searchTerm} ${category.searchTerm}`)
  const pool = candidates
    .map((candidate) => ({
      ...candidate,
      query: normalizePhrase(candidate.query ?? candidate.keyword),
    }))
    .filter((candidate) => candidate.query)
  const selected = []
  const used = new Set()

  function addItem(candidate, stage, reason) {
    const query = normalizePhrase(candidate?.query)
    if (!query || used.has(query)) return false
    used.add(query)
    selected.push({
      id: `etsy-insight-${selected.length + 1}`,
      query,
      stage,
      status: 'planned',
      discoveryLane: candidate.discoveryLane ?? 'baseline',
      queryStrategy: candidate.queryStrategy ?? 'direct',
      axisTerms: Array.isArray(candidate.axisTerms) ? [...candidate.axisTerms] : [],
      clusterKey: buildKeywordClusterKey(query, options),
      reason,
      sourceQuery: normalizePhrase(candidate.sourceQuery ?? ''),
      etsySearches30d: candidate.etsySearches30d ?? null,
      etsyListings: candidate.etsyListings ?? null,
      conversionLabel: String(candidate.conversionLabel ?? '').trim(),
      opportunityIndex: Number(candidate.opportunityIndex) || 0,
      cohortIndex: Number.isFinite(Number(candidate.cohortIndex)) ? Number(candidate.cohortIndex) : null,
      priorityIndex: Number.isFinite(Number(candidate.priorityIndex)) ? Number(candidate.priorityIndex) : null,
      officialProbe: candidate.officialProbe === true,
    })
    return true
  }

  addItem({ query: baselineQuery }, 'discovery', 'イベント全体の需要と供給を基準値として確認')
  const discoveryLanes = mode === 'plus'
    ? ['motif', 'moment', 'audience', 'aesthetic', 'adjacent']
    : ['motif', 'moment', 'audience', 'adjacent']
  for (const lane of discoveryLanes) {
    const candidate = pool.find((row) => row.discoveryLane === lane && !used.has(row.query))
    addItem(candidate, 'discovery', `${lane}レーンの入口を確認`)
  }

  const validationOrder = [
    ...pool.filter((row) => row.discoveryLane === 'aesthetic'),
    ...pool.filter((row) => row.queryStrategy === 'adjacent'),
    ...pool,
  ]
  for (const candidate of validationOrder) {
    if (selected.filter((item) => item.stage === 'validation').length >= config.validation) break
    addItem(candidate, 'validation', '候補の30日検索数と掲載数を比較')
  }

  for (const candidate of pool) {
    if (selected.filter((item) => item.stage === 'reserve').length >= config.reserve) break
    addItem(candidate, 'reserve', '関連語や結果差し替え用の予備')
  }

  if (mode === 'plus') {
    for (const candidate of pool) {
      if (selected.length >= config.seedQuota) break
      addItem(candidate, 'reserve', 'Plus初期調査を各レーンへ広げる追加候補')
    }

  }

  const candidatePool = mode === 'plus'
    ? rankMarketplaceInsightRelatedCandidates(options.relatedKeywordMetrics, options)
    : []

  const counts = {
    discovery: selected.filter((item) => item.stage === 'discovery').length,
    validation: selected.filter((item) => item.stage === 'validation').length,
    reserve: selected.filter((item) => item.stage === 'reserve').length,
    followup: selected.filter((item) => item.stage === 'followup').length,
  }
  return {
    mode,
    quota: config.quota,
    seedQuota: config.seedQuota,
    followUpBatchSize: 5,
    followUpCapacity: config.quota - config.seedQuota,
    followUpRemaining: Math.max(0, config.quota - selected.length),
    candidatePool,
    researchRound: 0,
    releasedFollowUpCount: 0,
    completedFollowUpCount: 0,
    stagnantRounds: 0,
    lastEvaluatedRound: 0,
    roundBaselineClusterKeys: [],
    stopReason: '',
    counts,
    items: selected.slice(0, config.quota),
  }
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
    .filter((intent) => intent && (options.includeGiftIntent === true || !/\bgift\b/.test(intent)))
  const tagQueries = unique((category.tags ?? [])
    .map((tag) => normalizePhrase(tag))
    .filter((tag) => tag && tag !== product && (options.includeGiftIntent === true || !/\bgift\b/.test(tag)))
    .slice(0, 4)
    .flatMap((tag) => eventTerm ? [`${eventTerm} ${tag}`, `${tag}`] : [tag]))
  const targetQueries = discoveryTargets.slice(0, eventTerm ? 18 : 42).flatMap((target) => (
    eventTerm
      ? [
          `${target} ${product}`,
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
    .filter((candidate) => !hasDuplicateGarmentProductTerms(candidate.keyword))
    .filter((candidate) => !hasConflictingRecipientRoles(candidate.keyword))
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

export function everbeeResultsToBroadListings(results = []) {
  const rows = []

  for (const result of results) {
    const productRows = Array.isArray(result?.productRows) ? result.productRows : []
    if (productRows.length > 0) {
      for (const product of productRows) {
        const title = String(product?.title ?? '').trim()
        if (!title) continue
        rows.push({
          title,
          tags: '',
          sales: parseNumber(product.monthlySales) ?? '',
          totalSales: parseNumber(product.totalSales) ?? '',
          revenue: parseNumber(product.monthlyRevenue ?? product.revenue) ?? '',
          listingAgeMonths: parseListingAgeMonths(product.listingAgeMonths ?? product.listingAge) ?? '',
          price: parseNumber(product.price) ?? '',
          shopName: String(product.shopName ?? '').trim(),
        })
      }
      continue
    }

    const snippets = Array.isArray(result?.listingSnippets) ? result.listingSnippets : []
    for (const snippet of snippets) {
      const title = String(snippet ?? '').trim()
      if (!title) continue
      rows.push({
        title,
        tags: '',
        sales: '',
        totalSales: '',
        revenue: '',
        listingAgeMonths: '',
        price: '',
        shopName: '',
      })
    }
  }

  const byTitle = new Map()
  for (const row of rows) {
    const key = normalizePhrase(row.title)
    const current = byTitle.get(key)
    if (!current || (parseNumber(row.sales) ?? -1) > (parseNumber(current.sales) ?? -1)) byTitle.set(key, row)
  }

  return Array.from(byTitle.values())
    .sort((a, b) => (parseNumber(b.sales) ?? -1) - (parseNumber(a.sales) ?? -1)
      || (parseNumber(b.revenue) ?? -1) - (parseNumber(a.revenue) ?? -1)
      || normalizePhrase(a.title).localeCompare(normalizePhrase(b.title), 'en'))
}

export function extractNicheHintsFromListings(listings = [], limit = 20, options = {}) {
  const hintStats = new Map()
  const stopWords = options.stopWords ?? []
  const keepWords = options.keepWords ?? []
  const blockedPhrases = new Set((options.blockedPhrases ?? []).map((phrase) => normalizePhrase(phrase)).filter(Boolean))
  const blockedTokens = new Set((options.blockedTokens ?? []).flatMap((phrase) => normalizePhrase(phrase).split(' ').filter(Boolean)))

  const pushHint = (phrase, weight, listingKey, isRecentSeller) => {
    const keyword = normalizePhrase(phrase)
    const tokens = keyword.split(' ').filter(Boolean)
    if (!keyword || blockedPhrases.has(keyword)) return
    if (tokens[0] === 'day' || tokens[tokens.length - 1] === 'from') return
    if (tokens.length === 1 && blockedTokens.has(tokens[0])) return
    if (tokens.length > 1 && blockedTokens.has(tokens[tokens.length - 1])) return
    if ([...blockedPhrases].some((blocked) => keyword.includes(blocked)) && !keyword.startsWith('first ')) return
    if (tokens.length > 1 && new Set(tokens).size !== tokens.length) return
    const current = hintStats.get(keyword) ?? {
      weightedScore: 0,
      listingKeys: new Set(),
      recentListingKeys: new Set(),
    }
    current.weightedScore += weight
    current.listingKeys.add(listingKey)
    if (isRecentSeller) current.recentListingKeys.add(listingKey)
    hintStats.set(keyword, current)
  }

  for (const [listingIndex, listing] of listings.entries()) {
    const title = listing.product_name ?? listing.title ?? listing.name ?? ''
    const tags = Array.isArray(listing.tags) ? listing.tags.join(' ') : listing.tags ?? ''
    const weightSource = parseNumber(listing.est_sales ?? listing.sales ?? listing.monthlySales ?? 0) ?? 0
    const listingAgeMonths = parseListingAgeMonths(listing.listingAgeMonths ?? listing.listingAge ?? listing.age)
    const recencyMultiplier = listingAgeMonths === null
      ? 1
      : listingAgeMonths <= 12 && weightSource > 0
        ? 1.5
        : listingAgeMonths <= 18 && weightSource > 0
          ? 1.2
          : listingAgeMonths <= 24
            ? 1
            : 0.6
    const weight = Math.max(1, Math.min(10, Math.round(weightSource / 10) || 1)) * recencyMultiplier
    const listingKey = String(listing.listingId ?? listing.id ?? listingIndex)
    const isRecentSeller = listingAgeMonths !== null && listingAgeMonths <= 12 && weightSource > 0
    const tagSegments = String(tags).split(/[,;|]+/).filter(Boolean)
    const segments = [title, ...tagSegments]
    const seenTokens = new Set()
    const seenHints = new Set()

    const pushListingHint = (phrase, hintWeight) => {
      const key = normalizePhrase(phrase)
      if (!key || seenHints.has(key)) return
      seenHints.add(key)
      pushHint(key, hintWeight, listingKey, isRecentSeller)
    }

    for (const segment of segments) {
      const tokens = tokenize(segment, stopWords, keepWords)
      for (const token of tokens) {
        if (seenTokens.has(token)) continue
        seenTokens.add(token)
        pushListingHint(token, weight)
      }

      for (let size = 2; size <= 3; size += 1) {
        for (let index = 0; index <= tokens.length - size; index += 1) {
          const phrase = tokens.slice(index, index + size).join(' ')
          if (phrase.length >= 7) pushListingHint(phrase, weight + size)
        }
      }
    }
  }

  return Array.from(hintStats.entries())
    .map(([keyword, stats]) => {
      const listingCount = stats.listingKeys.size
      const recentListingCount = stats.recentListingKeys.size
      const breadthBonus = Math.max(0, listingCount - 1) * 4
      const recentBreadthBonus = recentListingCount * 2
      return {
        keyword,
        count: Math.round((stats.weightedScore + breadthBonus + recentBreadthBonus) * 10) / 10,
        listingCount,
        recentListingCount,
      }
    })
    .sort((a, b) => b.count - a.count
      || b.recentListingCount - a.recentListingCount
      || b.listingCount - a.listingCount
      || a.keyword.localeCompare(b.keyword, 'en'))
    .slice(0, limit)
}

function roundedCrossNicheMetric(value) {
  if (!Number.isFinite(value)) return null
  return Math.round(value * 1000) / 1000
}

function medianNumber(values = []) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function crossNicheSalesEvidence(row = {}) {
  const productRows = Array.isArray(row.productRows) ? row.productRows : []
  const products = productRows
    .map((product) => ({
      monthlySales: parseNumber(product?.monthlySales ?? product?.sales) ?? 0,
      listingAgeMonths: parseListingAgeMonths(product?.listingAgeMonths ?? product?.listingAge),
    }))
    .filter((product) => product.monthlySales >= 0)
  const sellingProducts = products.filter((product) => product.monthlySales > 0)

  if (products.length > 0) {
    const monthlySales = sellingProducts.map((product) => product.monthlySales)
    return {
      hasEverbeeData: true,
      hasProductRows: true,
      sellingListingCount: sellingProducts.length,
      recentSellingListingCount: sellingProducts.filter((product) => (
        product.listingAgeMonths !== null && product.listingAgeMonths > 0 && product.listingAgeMonths <= 12
      )).length,
      totalMonthlySales: monthlySales.reduce((sum, value) => sum + value, 0),
      medianMonthlySales: medianNumber(monthlySales),
    }
  }

  const sellingListingCount = parseNumber(row.sellingListingCount)
  const recentSellingListingCount = parseNumber(row.recentSellingListingCount)
  const totalMonthlySales = parseNumber(row.totalVisibleMonthlySales)
  const medianMonthlySales = parseNumber(row.medianMonthlySales)
  const hasEverbeeData = [
    sellingListingCount,
    recentSellingListingCount,
    totalMonthlySales,
    medianMonthlySales,
  ].some((value) => value !== null)

  return {
    hasEverbeeData,
    hasProductRows: false,
    sellingListingCount: sellingListingCount ?? 0,
    recentSellingListingCount: recentSellingListingCount ?? 0,
    totalMonthlySales: totalMonthlySales ?? 0,
    medianMonthlySales,
  }
}

function crossNicheCompetitionEvidence(row = {}, options = {}) {
  const signals = [
    {
      source: 'everbee',
      value: parseNumber(row.listingsAnalyzed),
      threshold: Math.max(1, Number(options.crossNicheEverbeeCompetitionMin) || 10000),
    },
    {
      source: 'etsy',
      value: parseNumber(row.etsyListings),
      threshold: Math.max(1, Number(options.crossNicheEtsyCompetitionMin) || 20000),
    },
    {
      source: 'erank',
      value: parseNumber(row.erankCompetition),
      threshold: Math.max(1, Number(options.crossNicheErankCompetitionMin) || 50000),
    },
  ].filter((signal) => signal.value !== null && signal.value >= signal.threshold)

  return signals
    .map((signal) => ({ ...signal, saturationRatio: signal.value / signal.threshold }))
    .sort((left, right) => right.saturationRatio - left.saturationRatio
      || ['everbee', 'etsy', 'erank'].indexOf(left.source) - ['everbee', 'etsy', 'erank'].indexOf(right.source))[0] ?? null
}

function crossNicheDepth(row = {}) {
  const depth = Number(row.crossNicheDepth)
  return Number.isFinite(depth) && depth >= 0 ? Math.floor(depth) : 0
}

export function selectCrossNicheParentMarkets(rows = [], options = {}) {
  const maxDepth = Math.max(1, Math.min(Number(options.crossNicheMaxDepth) || 2, 3))
  const maxParents = Math.max(1, Math.min(Number(options.crossNicheParentLimit) || 3, 10))
  const customRiskTerms = splitSeedText(options.customRiskTerms)

  return rows
    .map((row) => {
      const keyword = normalizePhrase(row?.keyword)
      const depth = crossNicheDepth(row)
      const competition = crossNicheCompetitionEvidence(row, options)
      const sales = crossNicheSalesEvidence(row)
      const safe = keyword
        && depth < maxDepth
        && classifyCandidateKeyword(keyword, options).action !== 'reject'
        && detectRiskTerms(`${keyword} ${row?.notes ?? ''}`, customRiskTerms).length === 0
      const broadSales = sales.hasProductRows
        ? sales.sellingListingCount >= 2 && sales.totalMonthlySales >= 10
        : sales.sellingListingCount >= 3 && sales.totalMonthlySales >= 20

      if (!safe || !competition || !broadSales) return null

      const competitionPoints = Math.min(35, Math.log10(competition.value + 1) * 7)
      const salesPoints = Math.min(40, Math.log10(sales.totalMonthlySales + 1) * 18)
      const breadthPoints = Math.min(25, sales.sellingListingCount * 5 + sales.recentSellingListingCount * 2)
      return {
        keyword,
        depth,
        competition,
        sales,
        priorityScore: Math.round(Math.min(100, competitionPoints + salesPoints + breadthPoints)),
        row,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.priorityScore - left.priorityScore
      || right.sales.totalMonthlySales - left.sales.totalMonthlySales
      || left.keyword.localeCompare(right.keyword, 'en'))
    .slice(0, maxParents)
}

function sameSourceDemandSupply(parent = {}, child = {}) {
  const sources = [
    {
      source: 'etsy',
      parentDemand: parseNumber(parent.etsySearches30d),
      childDemand: parseNumber(child.etsySearches30d),
      parentCompetition: parseNumber(parent.etsyListings),
      childCompetition: parseNumber(child.etsyListings),
    },
    {
      source: 'erank',
      parentDemand: parseNumber(parent.erankSearchVolume),
      childDemand: parseNumber(child.erankSearchVolume),
      parentCompetition: parseNumber(parent.erankCompetition),
      childCompetition: parseNumber(child.erankCompetition),
    },
  ]

  return sources.find((source) => (
    source.parentDemand !== null
    && source.parentDemand > 0
    && source.childDemand !== null
    && source.childDemand >= 0
    && source.parentCompetition !== null
    && source.parentCompetition > 0
    && source.childCompetition !== null
    && source.childCompetition > 0
  )) ?? null
}

function sameSourceCompetition(parent = {}, child = {}) {
  const sources = [
    ['etsy', parent.etsyListings, child.etsyListings],
    ['erank', parent.erankCompetition, child.erankCompetition],
    ['everbee', parent.listingsAnalyzed, child.listingsAnalyzed],
  ]

  for (const [source, parentValue, childValue] of sources) {
    const parentCompetition = parseNumber(parentValue)
    const childCompetition = parseNumber(childValue)
    if (parentCompetition !== null && parentCompetition > 0 && childCompetition !== null && childCompetition > 0) {
      return { source, parentCompetition, childCompetition }
    }
  }
  return null
}

export function compareCrossNicheRows(parent = {}, child = {}) {
  const demandSupply = sameSourceDemandSupply(parent, child)
  const competition = demandSupply ?? sameSourceCompetition(parent, child)
  const parentSales = crossNicheSalesEvidence(parent)
  const childSales = crossNicheSalesEvidence(child)
  const competitionReduction = competition
    ? roundedCrossNicheMetric(1 - (competition.childCompetition / competition.parentCompetition))
    : null
  const demandRetention = demandSupply
    ? roundedCrossNicheMetric(demandSupply.childDemand / demandSupply.parentDemand)
    : null
  const parentEfficiency = demandSupply
    ? demandSupply.parentDemand / demandSupply.parentCompetition
    : null
  const childEfficiency = demandSupply
    ? demandSupply.childDemand / demandSupply.childCompetition
    : null
  const efficiencyLift = parentEfficiency && childEfficiency !== null
    ? roundedCrossNicheMetric(childEfficiency / parentEfficiency)
    : null
  const salesRetention = parentSales.medianMonthlySales !== null
    && parentSales.medianMonthlySales > 0
    && childSales.medianMonthlySales !== null
    ? roundedCrossNicheMetric(childSales.medianMonthlySales / parentSales.medianMonthlySales)
    : null

  let verdict = 'needs-research'
  if (demandRetention !== null && demandRetention < 0.03) verdict = 'weak-demand'
  else if (competitionReduction !== null && competitionReduction < 0.25) verdict = 'weak-competition'
  else if (
    childSales.hasEverbeeData
    && (childSales.sellingListingCount === 0 || (salesRetention !== null && salesRetention < 0.15))
  ) verdict = 'weak-sales'
  else if (
    competitionReduction !== null && competitionReduction >= 0.5
    && demandRetention !== null && demandRetention >= 0.1
    && efficiencyLift !== null && efficiencyLift >= 1.5
    && childSales.hasEverbeeData
    && childSales.sellingListingCount >= 2
    && (salesRetention === null || salesRetention >= 0.15)
  ) verdict = 'promising'
  else if (competitionReduction !== null || demandRetention !== null || childSales.hasEverbeeData) verdict = 'watch'

  return {
    source: demandSupply?.source ?? null,
    competitionSource: competition?.source ?? null,
    competitionReduction,
    demandRetention,
    efficiencyLift,
    salesRetention,
    sellingListingCount: childSales.sellingListingCount,
    recentSellingListingCount: childSales.recentSellingListingCount,
    verdict,
  }
}

function crossNicheProductTerms(category) {
  const family = CATEGORY_PRODUCT_FAMILY[category.id]
  return unique([
    category.searchTerm,
    ...(category.tags ?? []),
    ...(PRODUCT_FAMILY_TERMS[family] ?? []),
  ].flatMap((term) => phraseTokens(term)))
}

const CROSS_NICHE_TITLE_NOISE = new Set([
  'blank',
  'canvas',
  'color',
  'colors',
  'comfort',
  'gildan',
  'mockup',
  'shipping',
  'softstyle',
])

const BUYER_INTENT_VOCABULARY = {
  Identity: ['bride', 'groom', 'student', 'veteran', 'survivor', 'dog mom', 'dog dad', 'cat mom', 'cat dad', 'book lover'],
  Occupation: ['teacher', 'nurse', 'librarian', 'principal', 'firefighter', 'realtor', 'barber', 'accountant', 'mechanic', 'coach'],
  'Hobby/action': ['reading', 'book club', 'pickleball', 'camping', 'fishing', 'gardening', 'baking', 'running'],
  'Relationship/recipient': ['mom', 'dad', 'grandma', 'grandpa', 'coworker', 'friend', 'sister', 'brother', 'daughter', 'son', 'wife', 'husband'],
  'Life transition': ['retirement', 'graduation', 'new mom', 'new dad', 'mom to be', 'dad to be', 'first time mom', 'first time dad'],
  'Emotion/context': ['appreciation', 'birthday', 'reunion', 'memorial', 'support', 'proud'],
  Personalization: ['personalized', 'custom', 'name', 'year', 'team name', 'group name'],
  'Style/product': [...STYLE_ONLY_WORDS, ...Object.values(PRODUCT_FAMILY_TERMS).flat()],
}

const GROUP_INTENT_PHRASES = ['book club', 'family reunion', 'team', 'crew', 'squad', 'matching']
const GIVER_ROLES = ['students', 'student', 'daughter', 'son', 'team member', 'coworker', 'coworkers', 'family', 'friend']
const OCCASION_PHRASES = ['retirement', 'graduation', 'appreciation', 'birthday', 'reunion', 'wedding', 'baby shower', 'bridal shower']

function phraseAppears(source, phrase) {
  return ` ${normalizePhrase(source)} `.includes(` ${normalizePhrase(phrase)} `)
}

function firstMatchingPhrase(source, phrases) {
  return phrases.find((phrase) => phraseAppears(source, phrase)) ?? ''
}

export function classifyBuyerIntentPhrase(keyword) {
  const normalized = normalizePhrase(keyword)
  const buyerIntentAxes = Object.entries(BUYER_INTENT_VOCABULARY)
    .filter(([, phrases]) => phrases.some((phrase) => phraseAppears(normalized, phrase)))
    .map(([axis]) => axis)
  const rolePhrases = [
    ...BUYER_INTENT_VOCABULARY.Occupation,
    ...BUYER_INTENT_VOCABULARY['Relationship/recipient'],
    ...BUYER_INTENT_VOCABULARY.Identity,
  ]
  const recipientRole = firstMatchingPhrase(normalized, rolePhrases)
  const fromMatch = normalized.match(/\bfrom\s+([a-z]+(?:\s+[a-z]+)?)/)
  const giverRole = firstMatchingPhrase(fromMatch?.[1] ?? '', GIVER_ROLES)
  const occasion = firstMatchingPhrase(normalized, OCCASION_PHRASES)
  const personalization = firstMatchingPhrase(normalized, BUYER_INTENT_VOCABULARY.Personalization)
  const hasGiftIntent = /\bgifts?\b/.test(normalized)
  const genericRecipient = /\bgift\s+for\s+(?:her|him|women|men)\b/.test(normalized)
  const wearerIntent = hasGiftIntent || giverRole
    ? 'recipient'
    : GROUP_INTENT_PHRASES.some((phrase) => phraseAppears(normalized, phrase))
      ? 'group'
      : 'self'
  const eligible = !genericRecipient && !(hasGiftIntent && !recipientRole)

  return {
    eligible,
    buyerIntentAxes,
    wearerIntent,
    recipientRole,
    giverRole,
    occasion,
    personalization,
  }
}

function crossNicheModifier(value, parentCoreTokens, productTokens) {
  const parentSet = new Set(parentCoreTokens)
  const productSet = new Set(productTokens)
  const tokens = phraseTokens(value)
    .filter((token) => !parentSet.has(token))
    .filter((token) => !productSet.has(token))
    .filter((token) => !/^(?:19|20)\d{2}$/.test(token))
    .filter((token) => !GENERIC_WORDS.has(token))
    .filter((token) => !CROSS_NICHE_TITLE_NOISE.has(token))
  if (tokens.length === 0 || tokens.length > 3) return ''
  if (tokens.some((token) => CROSS_NICHE_TITLE_NOISE.has(token))) return ''
  if (tokens.every((token) => STYLE_ONLY_WORDS.has(token))) return ''
  return unique(tokens).join(' ')
}

function buildCrossNicheKeyword(parentKeyword, modifier, category) {
  const productTokens = crossNicheProductTerms(category)
  const productSet = new Set(productTokens)
  const parentCoreTokens = phraseTokens(parentKeyword).filter((token) => !productSet.has(token))
  const modifierTokens = phraseTokens(modifier)
    .filter((token) => !parentCoreTokens.includes(token))
    .filter((token) => !productSet.has(token))
  if (parentCoreTokens.length === 0 || modifierTokens.length === 0) return ''

  const parentFirst = parentCoreTokens.some((token) => BROAD_OCCASION_WORDS.has(token))
  const ordered = parentFirst
    ? [...parentCoreTokens, ...modifierTokens]
    : [...modifierTokens, ...parentCoreTokens]
  return normalizePhrase(`${unique(ordered).join(' ')} ${category.searchTerm}`)
}

function isCrossNicheCandidateSafe(keyword, parentKeyword, category, options) {
  if (!keyword || keyword === normalizePhrase(parentKeyword)) return false
  if (countWords(keyword) > 7 || countWords(keyword) <= countWords(parentKeyword)) return false
  if (!keywordMatchesCategoryProduct(keyword, category.id)) return false
  if (classifyCandidateKeyword(keyword, options).action !== 'candidate') return false
  if (hasDuplicateGarmentProductTerms(keyword)) return false
  if (hasConflictingRecipientRoles(keyword)) return false
  if (!classifyBuyerIntentPhrase(keyword).eligible) return false
  return detectRiskTerms(keyword, splitSeedText(options.customRiskTerms)).length === 0
}

export function buildCrossNicheDrilldown(rows = [], options = {}) {
  const category = getCategory(options.categoryId)
  const parents = selectCrossNicheParentMarkets(rows, options)
  const perParentLimit = Math.max(1, Math.min(Number(options.crossNichePerParentLimit) || 8, 20))
  const rowByKeyword = new Map(rows.map((row) => [normalizePhrase(row?.keyword), row]))
  const globalCandidates = new Map()

  const parentResults = parents.map((parent) => {
    const candidateMap = new Map()
    const productTokens = crossNicheProductTerms(category)
    const productSet = new Set(productTokens)
    const parentCoreTokens = phraseTokens(parent.keyword).filter((token) => !productSet.has(token))

    const addCandidate = ({ keyword, modifier, source, hint = null, row = null }) => {
      const normalized = normalizePhrase(keyword)
      if (!isCrossNicheCandidateSafe(normalized, parent.keyword, category, options)) return
      const buyerIntent = classifyBuyerIntentPhrase(normalized)
      const existing = candidateMap.get(normalized) ?? {
        keyword: normalized,
        parentKeyword: parent.keyword,
        modifier: normalizePhrase(modifier),
        depth: parent.depth + 1,
        sources: [],
        listingCount: 0,
        recentListingCount: 0,
        hintScore: 0,
        comparison: null,
        verdict: 'needs-research',
        priorityScore: 0,
        ...buyerIntent,
      }
      existing.sources = unique([...existing.sources, source])
      existing.listingCount = Math.max(existing.listingCount, Number(hint?.listingCount) || 0)
      existing.recentListingCount = Math.max(existing.recentListingCount, Number(hint?.recentListingCount) || 0)
      existing.hintScore = Math.max(existing.hintScore, Number(hint?.count) || 0)
      const measuredRow = row ?? rowByKeyword.get(normalized)
      if (measuredRow) {
        existing.comparison = compareCrossNicheRows(parent.row, measuredRow, options)
        existing.verdict = existing.comparison.verdict
      }
      candidateMap.set(normalized, existing)
    }

    const productRows = Array.isArray(parent.row.productRows) ? parent.row.productRows : []
    const hints = extractNicheHintsFromListings(productRows, 30, {
      stopWords: [parent.keyword, ...productTokens],
    })
    for (const hint of hints) {
      const modifier = crossNicheModifier(hint.keyword, parentCoreTokens, productTokens)
      if (!modifier) continue
      addCandidate({
        keyword: buildCrossNicheKeyword(parent.keyword, modifier, category),
        modifier,
        source: 'everbee-title',
        hint,
      })
    }

    for (const relatedTerm of splitSeedText(parent.row.etsyRelatedTerms)) {
      const normalized = normalizePhrase(relatedTerm)
      const modifier = crossNicheModifier(normalized, parentCoreTokens, productTokens)
      if (!modifier || !parentCoreTokens.every((token) => phraseTokens(normalized).includes(token))) continue
      const keyword = keywordMatchesCategoryProduct(normalized, category.id)
        ? normalized
        : buildCrossNicheKeyword(parent.keyword, modifier, category)
      addCandidate({ keyword, modifier, source: 'etsy-related' })
    }

    for (const row of rows) {
      const keyword = normalizePhrase(row?.keyword)
      const tokens = phraseTokens(keyword)
      if (!keyword || keyword === parent.keyword) continue
      if (!parentCoreTokens.every((token) => tokens.includes(token))) continue
      const modifier = crossNicheModifier(keyword, parentCoreTokens, productTokens)
      if (!modifier) continue
      addCandidate({ keyword, modifier, source: 'measured-child', row })
    }

    const candidates = Array.from(candidateMap.values())
      .filter((candidate) => (
        candidate.sources.includes('etsy-related')
        || candidate.sources.includes('measured-child')
        || candidate.listingCount >= 2
      ))
      .map((candidate) => {
        const verdictPoints = candidate.verdict === 'promising'
          ? 45
          : candidate.verdict === 'watch'
            ? 18
            : candidate.verdict.startsWith('weak-')
              ? -45
              : 8
        const sourcePoints = candidate.sources.includes('measured-child')
          ? 12
          : candidate.sources.includes('etsy-related')
            ? 9
            : 0
        const evidencePoints = Math.min(28, candidate.hintScore)
          + Math.min(12, candidate.listingCount * 3)
          + Math.min(12, candidate.recentListingCount * 4)
        return {
          ...candidate,
          priorityScore: Math.max(0, Math.min(100, Math.round(20 + verdictPoints + sourcePoints + evidencePoints))),
        }
      })
      .sort((left, right) => right.priorityScore - left.priorityScore
        || right.recentListingCount - left.recentListingCount
        || right.listingCount - left.listingCount
        || left.keyword.localeCompare(right.keyword, 'en'))
      .slice(0, perParentLimit)

    for (const candidate of candidates) {
      const current = globalCandidates.get(candidate.keyword)
      if (!current || candidate.priorityScore > current.priorityScore) globalCandidates.set(candidate.keyword, candidate)
    }

    return { ...parent, candidates }
  })

  const candidates = Array.from(globalCandidates.values())
    .sort((left, right) => right.priorityScore - left.priorityScore
      || left.keyword.localeCompare(right.keyword, 'en'))

  return {
    parents: parentResults,
    candidates,
    researchCandidates: candidates
      .filter((candidate) => !candidate.verdict.startsWith('weak-'))
      .slice(0, Math.max(1, Math.min(Number(options.crossNicheResearchLimit) || 12, 30))),
    maxDepth: Math.max(1, Math.min(Number(options.crossNicheMaxDepth) || 2, 3)),
  }
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

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

export function aggregateEverbeeListings(listings = []) {
  const normalized = listings.map((listing) => ({
    monthlySales: parseNumber(listing.monthlySales ?? listing.topMonthlySales ?? listing.estSales),
    monthlyRevenue: parseNumber(listing.monthlyRevenue ?? listing.revenue ?? listing.topRevenue),
    listingAgeMonths: parseListingAgeMonths(listing.listingAgeMonths ?? listing.listingAge ?? listing.age),
  }))
  const salesValues = normalized.map((listing) => listing.monthlySales).filter((value) => value !== null)
  const revenueValues = normalized.map((listing) => listing.monthlyRevenue).filter((value) => value !== null)
  const ageValues = normalized.map((listing) => listing.listingAgeMonths).filter((value) => value !== null)
  const sellingListings = normalized.filter((listing) => listing.monthlySales !== null && listing.monthlySales > 0)
  const recentSellingListings = sellingListings.filter((listing) => (
    listing.listingAgeMonths !== null && listing.listingAgeMonths <= 18
  ))
  const totalVisibleMonthlySales = salesValues.length > 0
    ? salesValues.reduce((sum, value) => sum + value, 0)
    : null
  const topMonthlySales = salesValues.length > 0 ? Math.max(...salesValues) : null

  return {
    visibleListingCount: listings.length,
    sellingListingCount: sellingListings.length,
    recentSellingListingCount: recentSellingListings.length,
    medianMonthlySales: median(salesValues),
    medianMonthlyRevenue: median(revenueValues),
    totalVisibleMonthlySales,
    topMonthlySales,
    topSalesShare: totalVisibleMonthlySales !== null && totalVisibleMonthlySales > 0 && topMonthlySales !== null
      ? topMonthlySales / totalVisibleMonthlySales
      : null,
    medianListingAgeMonths: median(ageValues),
  }
}

function scoreBand(value, bands) {
  for (const band of bands) {
    if (band.test(value)) return band.points
  }
  return 0
}

function densityPerThousand(numerator, denominator) {
  if (numerator === null || denominator === null || denominator <= 0) return null
  return (numerator / denominator) * 1000
}

function demandSignalBand(searches, clicks = null) {
  if (searches === null && clicks === null) return null
  if ((searches ?? 0) >= 100 || (clicks ?? 0) >= 30) return 2
  if ((searches ?? 0) >= 50 || (clicks ?? 0) >= 15) return 1
  return 0
}

function partialSupplyScore(sourceId, values = {}) {
  if (sourceId === 'etsy') {
    const listings = values.etsyListings
    if (listings === null) return 0
    if (listings < 30000) return 14
    if (listings < 50000) return 8
    if (listings < 100000) return 4
    return 0
  }

  if (sourceId === 'erank') {
    const competition = values.erankCompetition
    const difficulty = values.erankKeywordDifficulty
    const competitionPoints = competition === null
      ? 0
      : competition < 30000
        ? 14
        : competition < 50000
          ? 8
          : competition < 100000
            ? 4
            : 0
    const difficultyPoints = difficulty === null
      ? 0
      : difficulty <= 55
        ? 14
        : difficulty <= 65
          ? 8
          : difficulty <= 75
            ? 4
            : 0
    return Math.max(competitionPoints, difficultyPoints)
  }

  return 0
}

function everbeeCompetitionEvidence(listingsAnalyzed) {
  if (listingsAnalyzed === null) {
    return {
      score: 0,
      band: 'unknown',
      status: 'warn',
      label: 'EverBee競合未取得',
      detail: 'Listings Analyzedを取得して競合規模を確認します。',
      supportsA: true,
      supportsB: true,
      scoreCap: 100,
    }
  }

  if (listingsAnalyzed <= 0) {
    return {
      score: 0,
      band: 'empty',
      status: 'bad',
      label: 'EverBee結果なし',
      detail: '競合が少ないのではなく、検索結果または取得結果が空です。',
      supportsA: false,
      supportsB: false,
      scoreCap: 39,
    }
  }

  if (listingsAnalyzed <= 500) {
    return { score: 20, band: 'ultra-low', status: 'strong', label: '競合が非常に少ない', detail: 'EverBee競合500件以下です。需要と複数商品の販売があれば最優先候補です。', supportsA: true, supportsB: true, scoreCap: 100 }
  }
  if (listingsAnalyzed <= 1000) {
    return { score: 18, band: 'very-low', status: 'strong', label: '競合がかなり少ない', detail: 'EverBee競合1,000件以下です。', supportsA: true, supportsB: true, scoreCap: 100 }
  }
  if (listingsAnalyzed <= 2500) {
    return { score: 15, band: 'low', status: 'strong', label: '競合が少ない', detail: 'EverBee競合2,500件以下です。', supportsA: true, supportsB: true, scoreCap: 100 }
  }
  if (listingsAnalyzed <= 5000) {
    return { score: 12, band: 'low', status: 'strong', label: '競合が少なめ', detail: 'EverBee競合5,000件以下です。', supportsA: true, supportsB: true, scoreCap: 100 }
  }
  if (listingsAnalyzed <= 10000) {
    return { score: 8, band: 'medium', status: 'warn', label: '競合は中程度', detail: '販売の広がりと新しい売れ筋を確認します。', supportsA: true, supportsB: true, scoreCap: 100 }
  }
  if (listingsAnalyzed < 15000) {
    return { score: 4, band: 'high', status: 'warn', label: '競合はやや多い', detail: '強い需要と複数商品の販売証拠が必要です。', supportsA: true, supportsB: true, scoreCap: 100 }
  }
  if (listingsAnalyzed <= 20000) {
    return { score: 4, band: 'high', status: 'warn', label: '競合が多い', detail: 'A判定にはせず、小さなテスト候補として判断します。', supportsA: false, supportsB: true, scoreCap: 100 }
  }
  if (listingsAnalyzed < 30000) {
    return { score: 1, band: 'very-high', status: 'bad', label: '競合がかなり多い', detail: '強い需要と新規売れ筋がそろう場合だけ小さく試します。', supportsA: false, supportsB: true, scoreCap: 100 }
  }

  return {
    score: 0,
    band: 'saturated',
    status: 'bad',
    label: '競合過密',
    detail: '直接狙わず、売れ筋商品から細分化した派生語を探します。',
    supportsA: false,
    supportsB: false,
    scoreCap: listingsAnalyzed >= 50000 ? 29 : 39,
  }
}

export function scoreEverbeeResult(row = {}, options = {}) {
  const keyword = normalizePhrase(row.keyword)
  const listingsAnalyzed = parseNumber(row.listingsAnalyzed)
  const topMonthlySales = parseNumber(row.topMonthlySales)
  const topRevenue = parseNumber(row.topRevenue)
  const averagePrice = parseNumber(row.averagePrice)
  const listingAgeMonths = parseListingAgeMonths(row.listingAge)
  const visibleListingCount = parseNumber(row.visibleListingCount)
  const sellingListingCount = parseNumber(row.sellingListingCount)
  const recentSellingListingCount = parseNumber(row.recentSellingListingCount)
  const medianMonthlySales = parseNumber(row.medianMonthlySales)
  const medianMonthlyRevenue = parseNumber(row.medianMonthlyRevenue)
  const totalVisibleMonthlySales = parseNumber(row.totalVisibleMonthlySales)
  const topSalesShare = parseNumber(row.topSalesShare)
  const medianListingAgeMonths = parseListingAgeMonths(row.medianListingAgeMonths)
  const erankSearchVolume = parseNumber(row.erankSearchVolume)
  const erankClicks = parseNumber(row.erankClicks)
  const erankCtr = parseNumber(row.erankCtr)
  const erankCompetition = parseNumber(row.erankCompetition)
  const erankKeywordDifficulty = parseNumber(row.erankKeywordDifficulty)
  const erankTrend = parseNumber(row.erankTrend)
  const etsySearches30d = parseNumber(row.etsySearches30d)
  const etsyListings = parseNumber(row.etsyListings)
  const etsyRelatedTerms = unique(Array.isArray(row.etsyRelatedTerms)
    ? row.etsyRelatedTerms.map((term) => normalizePhrase(term))
    : splitSeedText(row.etsyRelatedTerms))
  const candidateClass = classifyCandidateKeyword(keyword, options)
  const riskTerms = detectRiskTerms(`${keyword} ${row.notes ?? ''}`, splitSeedText(options.customRiskTerms))
  const erankClickDensity = densityPerThousand(erankClicks, erankCompetition)
  const etsySearchDensity = densityPerThousand(etsySearches30d, etsyListings)

  const erankFreshness = getSourceFreshness(row.erankCheckedAt ?? row.checkedAt, options.now)
  const etsyMarketplaceFreshness = getMarketplaceInsightFreshness(row.etsyCheckedAt, options.now)
  const everbeeFreshness = getSourceFreshness(row.everbeeCheckedAt ?? row.checkedAt, options.now)
  const hasErankData = erankSearchVolume !== null || erankClicks !== null || erankCtr !== null || erankCompetition !== null || erankKeywordDifficulty !== null || erankTrend !== null
  const hasEtsyMarketplaceData = etsySearches30d !== null || etsyListings !== null || etsyRelatedTerms.length > 0
  const hasEverbeeAggregate = visibleListingCount !== null
    && sellingListingCount !== null
    && recentSellingListingCount !== null
    && medianMonthlySales !== null
    && totalVisibleMonthlySales !== null
    && medianListingAgeMonths !== null
    && (totalVisibleMonthlySales === 0 || topSalesShare !== null)
  const hasEverbeeData = hasEverbeeAggregate || listingsAnalyzed !== null || topMonthlySales !== null || topRevenue !== null
  const hasErankDemand = erankSearchVolume !== null || erankClicks !== null
  const hasErankSupply = erankCompetition !== null || erankKeywordDifficulty !== null
  const hasErankCore = hasErankDemand && hasErankSupply
  const hasEtsyMarketplaceCore = etsySearches30d !== null && etsyListings !== null
  const everbeePositive = (sellingListingCount ?? 0) > 0 || (topMonthlySales ?? 0) > 0 || (topRevenue ?? 0) > 0
  const erankPositive = (erankSearchVolume ?? 0) > 0 || (erankClicks ?? 0) > 0 || (erankCtr ?? 0) > 0
  const etsyMarketplacePositive = (etsySearches30d ?? 0) > 0
  const erankDemandPass = (erankSearchVolume !== null && erankSearchVolume >= 100)
    || (erankClicks !== null && erankClicks >= 30)
  const etsyDemandPass = etsySearches30d !== null && etsySearches30d >= 100
  const erankDemandBand = demandSignalBand(erankSearchVolume, erankClicks)
  const etsyDemandBand = demandSignalBand(etsySearches30d)
  const demandSignalGap = erankDemandBand === null || etsyDemandBand === null
    ? 0
    : Math.abs(erankDemandBand - etsyDemandBand)
  const demandSourceConflict = demandSignalGap > 0
  const erankSupplyPass = (erankKeywordDifficulty !== null && erankKeywordDifficulty <= 45)
    || (erankCompetition !== null && erankCompetition < 20000)
  const etsySupplyPass = etsyListings !== null && etsyListings < 20000
  const demandSupplySources = [
    {
      id: 'etsy',
      hasCore: hasEtsyMarketplaceCore,
      fresh: hasEtsyMarketplaceCore && etsyMarketplaceFreshness.eligibleForRanking,
      demandPass: etsyDemandPass,
      supplyPass: etsySupplyPass,
    },
    {
      id: 'erank',
      hasCore: hasErankCore,
      fresh: hasErankCore && erankFreshness.eligibleForRanking,
      demandPass: erankDemandPass,
      supplyPass: erankSupplyPass,
    },
  ]
    .filter((source) => source.hasCore)
    .sort((left, right) => {
      const sourceScore = (source) => (
        (source.fresh ? 100 : 0)
        + (source.demandPass && source.supplyPass ? 20 : 0)
        + (source.demandPass ? 2 : 0)
        + (source.supplyPass ? 1 : 0)
        + (source.id === 'etsy' ? 0.1 : 0)
      )
      return sourceScore(right) - sourceScore(left)
    })
  const selectedDemandSupplySource = demandSupplySources[0] ?? null
  const demandPass = Boolean(selectedDemandSupplySource?.demandPass)
  const supplyPass = Boolean(selectedDemandSupplySource?.supplyPass)
  const salesBreadthPass = (recentSellingListingCount !== null && recentSellingListingCount >= 2)
    || (
      sellingListingCount !== null
      && sellingListingCount >= 3
      && medianMonthlySales !== null
      && medianMonthlySales >= 1
    )
  const concentrationPass = totalVisibleMonthlySales !== null
    && totalVisibleMonthlySales > 0
    && topSalesShare !== null
    && topSalesShare < 0.7
  const freshDemandSupplyCore = Boolean(selectedDemandSupplySource?.fresh)
  const freshnessPass = freshDemandSupplyCore && everbeeFreshness.eligibleForRanking
  const safetyPass = riskTerms.length === 0 && candidateClass.action !== 'reject'
  const everbeeCompetition = everbeeCompetitionEvidence(listingsAnalyzed)
  const competitionUnverified = listingsAnalyzed === null
    && !hasErankSupply
    && etsyListings === null

  let confidenceLabel = 'Low'
  if (freshDemandSupplyCore && hasEverbeeAggregate && freshnessPass) confidenceLabel = 'High'
  else if (
    (hasErankCore || hasEtsyMarketplaceCore || hasEverbeeAggregate)
    && (erankFreshness.capturedAt || etsyMarketplaceFreshness.capturedAt || everbeeFreshness.capturedAt)
    && (!hasErankCore || erankFreshness.freshnessLabel !== 'expired')
    && (!hasEtsyMarketplaceCore || etsyMarketplaceFreshness.freshnessLabel !== 'expired')
    && everbeeFreshness.freshnessLabel !== 'expired'
  ) confidenceLabel = 'Medium'

  const gateReasons = []
  if (!demandPass) gateReasons.push('demand')
  if (!supplyPass) gateReasons.push('supply')
  if (!salesBreadthPass) gateReasons.push('sales-breadth')
  if (!concentrationPass) gateReasons.push('sales-concentration')
  if (!freshnessPass) gateReasons.push('freshness')
  if (confidenceLabel !== 'High') gateReasons.push('confidence')
  if (['empty', 'saturated'].includes(everbeeCompetition.band)) gateReasons.push('everbee-competition')
  if (competitionUnverified) gateReasons.push('competition-unverified')
  if (!safetyPass) gateReasons.push('safety')

  const demandScore = demandPass
    ? 18
    : (erankSearchVolume ?? 0) >= 50 || (erankClicks ?? 0) >= 15 || (etsySearches30d ?? 0) >= 50
      ? 8
      : 0
  const supplyScore = supplyPass
    ? 14
    : Math.min(10, partialSupplyScore(selectedDemandSupplySource?.id, {
      etsyListings,
      erankCompetition,
      erankKeywordDifficulty,
    })) || (hasErankSupply || etsyListings !== null ? 3 : 0)
  const everbeeCompetitionScore = everbeeCompetition.score
  const salesBreadthScore = salesBreadthPass ? 20 : (sellingListingCount ?? 0) >= 2 ? 10 : (sellingListingCount ?? 0) > 0 ? 4 : 0
  const medianSalesScore = (medianMonthlySales ?? 0) >= 3 ? 8 : (medianMonthlySales ?? 0) >= 1 ? 5 : 0
  const concentrationScore = concentrationPass ? 8 : topSalesShare !== null && topSalesShare < 0.85 ? 3 : 0
  const freshnessScore = freshnessPass
    ? 7
    : erankFreshness.eligibleForRanking || etsyMarketplaceFreshness.eligibleForRanking || everbeeFreshness.eligibleForRanking
      ? 3
      : 0
  const confidenceScore = confidenceLabel === 'High' ? 5 : confidenceLabel === 'Medium' ? 3 : 0
  const sourceConsistencyScore = demandSourceConflict ? -5 : 0
  const rawScore = demandScore + supplyScore + everbeeCompetitionScore + salesBreadthScore + medianSalesScore + concentrationScore + freshnessScore + confidenceScore + sourceConsistencyScore
  const scoreCap = competitionUnverified ? Math.min(39, everbeeCompetition.scoreCap) : everbeeCompetition.scoreCap
  const score = safetyPass ? Math.max(0, Math.min(scoreCap, rawScore)) : 0

  const passesAGates = gateReasons.length === 0 && everbeeCompetition.supportsA
  const passesErankBGates = hasErankCore
    && erankFreshness.eligibleForRanking
    && erankSupplyPass
    && (
      (erankDemandPass && (sellingListingCount ?? 0) >= 2 && (topSalesShare ?? 1) < 0.85)
      || (salesBreadthPass && ((erankSearchVolume ?? 0) >= 50 || (erankClicks ?? 0) >= 15))
    )
  const passesEtsyMarketplaceBGates = hasEtsyMarketplaceCore
    && etsyMarketplaceFreshness.eligibleForRanking
    && (etsySearches30d ?? 0) >= 50
    && (etsyListings ?? Infinity) < 50000
    && (sellingListingCount ?? 0) >= 2
    && (topSalesShare ?? 1) < 0.8
  const passesBGates = safetyPass
    && freshnessPass
    && hasEverbeeAggregate
    && everbeeCompetition.supportsB
    && (passesErankBGates || passesEtsyMarketplaceBGates)

  let opportunityLabel = 'C'
  if (!safetyPass) opportunityLabel = 'D'
  else if (passesAGates) opportunityLabel = 'A'
  else if (passesBGates) opportunityLabel = 'B'

  let demandSupplySource = selectedDemandSupplySource?.id ?? null
  if (opportunityLabel === 'B') {
    if (passesEtsyMarketplaceBGates) demandSupplySource = 'etsy'
    else if (passesErankBGates) demandSupplySource = 'erank'
  }

  const label = opportunityLabel === 'A'
    ? 'A: 今すぐ候補'
    : opportunityLabel === 'B'
      ? 'B: 小さく試す'
      : opportunityLabel === 'C'
        ? 'C: 派生探索'
        : 'D: 除外候補'

  const exclusionReasons = []
  if (candidateClass.action === 'reject') exclusionReasons.push(candidateClass.reason)
  if (riskTerms.length > 0) exclusionReasons.push(`要確認語句: ${riskTerms.join(', ')}`)
  if (!freshnessPass && (hasErankData || hasEtsyMarketplaceData || hasEverbeeData)) exclusionReasons.push('需要・供給データまたはEverBeeの取得日が期限超過または不明')
  if (topSalesShare !== null && topSalesShare >= 0.7) exclusionReasons.push('見えている販売が1商品に集中')
  if (!salesBreadthPass && hasEverbeeAggregate) exclusionReasons.push('複数商品の販売実績が不足')
  if (demandSourceConflict) exclusionReasons.push('Etsy公式とeRankで需要の強さが不一致')

  let validationLabel = '未検証'
  if (hasEverbeeData && (hasErankData || hasEtsyMarketplaceData) && everbeePositive && (erankPositive || etsyMarketplacePositive)) validationLabel = '需要・販売OK'
  else if (hasEverbeeData && (hasErankData || hasEtsyMarketplaceData)) validationLabel = '要判断'
  else if (hasEverbeeData) validationLabel = 'EverBeeのみ'
  else if (hasEtsyMarketplaceData) validationLabel = 'Etsy公式のみ'
  else if (hasErankData) validationLabel = 'eRankのみ'

  const candidateStage = opportunityLabel === 'D'
    ? 'reject'
    : opportunityLabel === 'A' || opportunityLabel === 'B'
      ? 'opportunity'
      : hasEverbeeData
        ? 'sales-checked'
        : hasErankData || hasEtsyMarketplaceData
          ? 'demand-checked'
          : 'idea'

  return {
    score,
    label,
    opportunityLabel,
    confidenceLabel,
    candidateStage,
    gateReasons,
    parts: {
      competitionScore: everbeeCompetitionScore,
      everbeeCompetitionScore,
      demandScore,
      revenueScore: 0,
      trendScore: 0,
      priceScore: 0,
      erankDemandScore: demandScore,
      erankCompetitionScore: supplyScore,
      erankCtrScore: 0,
      erankKeywordDifficultyScore: supplyScore,
      erankTrendScore: 0,
      erankSearchScore: demandScore,
      erankClickScore: demandScore,
      etsyMarketplaceDemandScore: demandScore,
      etsyMarketplaceSupplyScore: supplyScore,
      salesDensityScore: 0,
      revenueDensityScore: 0,
      erankClickDensityScore: 0,
      candidateAction: candidateClass.action,
      oldReferencePenalty: 0,
      tooFreshPenalty: 0,
      listingCompetitionPenalty: Math.max(0, rawScore - score),
      scoreCap,
      riskPenalty: safetyPass ? 0 : 100,
      salesBreadthScore,
      medianSalesScore,
      concentrationScore,
      freshnessScore,
      confidenceScore,
      sourceConsistencyScore,
    },
    validation: {
      label: validationLabel,
      hasEverbeeData,
      hasErankData,
      hasEtsyMarketplaceData,
      everbeePositive,
      erankPositive,
      etsyMarketplacePositive,
      demandSupplySource,
      demandSourceConflict,
      demandSignalGap,
    },
    normalized: {
      keyword,
      listingsAnalyzed,
      everbeeCompetitionBand: everbeeCompetition.band,
      everbeeCompetitionScore,
      topMonthlySales,
      topRevenue,
      averagePrice,
      listingAgeMonths,
      visibleListingCount,
      sellingListingCount,
      recentSellingListingCount,
      medianMonthlySales,
      medianMonthlyRevenue,
      totalVisibleMonthlySales,
      topSalesShare,
      medianListingAgeMonths,
      erankSearchVolume,
      erankClicks,
      erankCtr,
      erankCompetition,
      erankKeywordDifficulty,
      erankTrend,
      etsySearches30d,
      etsyListings,
      etsyRelatedTerms,
      erankCheckedAt: erankFreshness.capturedAt,
      etsyCheckedAt: etsyMarketplaceFreshness.capturedAt,
      everbeeCheckedAt: everbeeFreshness.capturedAt,
      erankFreshness,
      etsyMarketplaceFreshness,
      everbeeFreshness,
      salesDensity: null,
      revenueDensity: null,
      erankClickDensity,
      etsySearchDensity,
      erankDemandBand,
      etsyDemandBand,
      candidateClass,
      notes: row.notes ?? '',
    },
    riskTerms,
    exclusionReasons,
  }
}

function evidenceValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value * 10) / 10
    return `${rounded}${suffix}`
  }
  return `${value}${suffix}`
}

function evidenceStatus(status, label, detail) {
  return { status, label, detail }
}

export function explainEverbeeScore(score) {
  const normalized = score.normalized ?? {}
  const usesEtsyMarketplace = score.validation?.demandSupplySource === 'etsy'
  const demandSourceLabel = usesEtsyMarketplace ? 'Etsy公式' : 'eRank'
  const demandPass = !score.gateReasons?.includes('demand')
  const supplyPass = !score.gateReasons?.includes('supply')
  const breadthPass = !score.gateReasons?.includes('sales-breadth')
  const concentrationPass = !score.gateReasons?.includes('sales-concentration')
  const freshnessPass = !score.gateReasons?.includes('freshness')
  const demandSourceConflict = Boolean(score.validation?.demandSourceConflict)
  const demand = demandPass
    ? evidenceStatus('strong', '需要あり', usesEtsyMarketplace ? 'Etsy公式の直近30日検索数が基準を満たしています。' : 'eRankの検索数またはクリックが基準を満たしています。')
    : evidenceStatus('weak', '需要不足/未取得', usesEtsyMarketplace ? 'Etsy公式の直近30日検索数100以上を確認します。' : 'Average Searches 100以上、またはAverage Clicks 30以上を確認します。')
  const supply = supplyPass
    ? evidenceStatus('strong', '参入余地あり', usesEtsyMarketplace ? 'Etsy公式の掲載数が基準内です。' : 'eRankのKDまたはCompetitionが基準を満たしています。')
    : evidenceStatus('weak', '競合根拠が弱い', usesEtsyMarketplace ? 'Etsy公式の掲載数20,000未満をA判定の基準にします。' : 'KD 45以下、またはCompetition 20,000未満を確認します。')
  const breadth = breadthPass
    ? evidenceStatus('strong', '複数商品で販売', 'EverBeeの表示範囲で複数商品に販売実績があります。')
    : evidenceStatus('bad', '販売の広がり不足', '代表商品1件ではなく、複数商品が売れているかを確認します。')
  const concentration = concentrationPass
    ? evidenceStatus('strong', '集中度は許容範囲', 'トップ商品の販売比率が70%未満です。')
    : normalized.topSalesShare === null
      ? evidenceStatus('warn', '集中度未取得', '見えている商品の合計販売数とトップ販売数が必要です。')
      : evidenceStatus('bad', 'トップ商品に集中', '一つのヒット商品を市場全体の需要と誤認しないよう注意します。')
  const everbeeCompetition = everbeeCompetitionEvidence(normalized.listingsAnalyzed ?? null)
  const freshness = freshnessPass
    ? evidenceStatus('strong', '有効期限内', usesEtsyMarketplace ? 'Etsy公式は7日以内、EverBeeは45日以内に確認されています。' : 'eRankとEverBeeの両方が45日以内に確認されています。')
    : evidenceStatus('warn', '古い/取得日不明', '古いデータは発想用に留め、再調査してから昇格します。')
  const risk = score.riskTerms?.length
    ? evidenceStatus('bad', 'IP/商標リスク', `要確認語句: ${score.riskTerms.join(', ')}`)
    : evidenceStatus('strong', '大きなリスク語なし', '既知の危険語リストには当たりませんでした。最後にEtsy上で確認してください。')
  const sourceConsistency = demandSourceConflict
    ? evidenceStatus('warn', '需要ソースに差あり', 'Etsy公式とeRankで需要の強さが異なるため、順位を下げています。')
    : normalized.erankDemandBand === null || normalized.etsyDemandBand === null
      ? evidenceStatus('warn', '片方のみ確認', 'Etsy公式とeRankの両方がそろうと判断の確度が上がります。')
      : evidenceStatus('strong', '需要ソース一致', 'Etsy公式とeRankで需要の強さが同じ帯にあります。')

  const summary = score.opportunityLabel === 'A'
    ? `${demandSourceLabel}の需要・供給とEverBeeの複数商品販売が新しいデータでそろった直接テスト候補です。`
    : score.opportunityLabel === 'B'
      ? '需要・供給・複数商品の販売は確認できていますが、小さく試して反応を記録する候補です。'
      : score.opportunityLabel === 'C'
        ? '根拠が一部不足しています。派生語の探索または再取得を優先します。'
        : '除外または参考市場です。売れていても、新規が入れる根拠が足りません。'

  return {
    summary,
    rows: [
      {
        ...demand,
        key: 'demand',
        metric: `${demandSourceLabel}需要`,
        value: usesEtsyMarketplace
          ? `30d Searches ${evidenceValue(normalized.etsySearches30d)}`
          : `Search ${evidenceValue(normalized.erankSearchVolume)} / Clicks ${evidenceValue(normalized.erankClicks)}`,
      },
      {
        ...supply,
        key: 'supply',
        metric: `${demandSourceLabel}供給`,
        value: usesEtsyMarketplace
          ? `Listings ${evidenceValue(normalized.etsyListings)}`
          : `Comp ${evidenceValue(normalized.erankCompetition)} / KD ${evidenceValue(normalized.erankKeywordDifficulty)}`,
      },
      {
        status: everbeeCompetition.status,
        label: everbeeCompetition.label,
        detail: everbeeCompetition.detail,
        key: 'everbeeCompetition',
        metric: 'EverBee競合',
        value: evidenceValue(normalized.listingsAnalyzed),
      },
      {
        ...sourceConsistency,
        key: 'sourceConsistency',
        metric: '需要ソース整合',
        value: `Etsy ${evidenceValue(normalized.etsyDemandBand)} / eRank ${evidenceValue(normalized.erankDemandBand)}`,
      },
      {
        ...breadth,
        key: 'salesBreadth',
        metric: '販売の広がり',
        value: `Selling ${evidenceValue(normalized.sellingListingCount)} / Recent ${evidenceValue(normalized.recentSellingListingCount)}`,
      },
      {
        ...concentration,
        key: 'concentration',
        metric: '販売集中度',
        value: normalized.topSalesShare === null ? '-' : `${Math.round(normalized.topSalesShare * 100)}%`,
      },
      {
        ...freshness,
        key: 'freshness',
        metric: 'データ鮮度',
        value: usesEtsyMarketplace
          ? `Etsy ${normalized.etsyMarketplaceFreshness?.freshnessDays ?? '-'}日 / EverBee ${normalized.everbeeFreshness?.freshnessDays ?? '-'}日`
          : `eRank ${normalized.erankFreshness?.freshnessDays ?? '-'}日 / EverBee ${normalized.everbeeFreshness?.freshnessDays ?? '-'}日`,
      },
      {
        ...risk,
        key: 'risk',
        metric: 'リスク',
        value: score.riskTerms?.length ? score.riskTerms.join(', ') : 'OK',
      },
    ],
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
  const candidateClass = classifyCandidateKeyword(keyword, options)

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
  const structuralPenalty = candidateClass.action === 'explore' ? 25 : 0
  const competitionConfidenceScore = Math.max(competitionScore, keywordDifficultyScore)
  const missingCompetitionSignal = erankCompetition === null && erankKeywordDifficulty === null
  const rawScore = searchScore + clickScore + ctrScore + competitionConfidenceScore + trendScore - riskPenalty - structuralPenalty
  const cappedScore = missingCompetitionSignal && rawScore >= 62 ? 61 : rawScore
  const score = candidateClass.action === 'reject' || riskTerms.length > 0
    ? 0
    : hasErankData && hasDemand
    ? Math.max(0, Math.min(100, cappedScore))
    : 0

  const reasons = []
  if (candidateClass.action !== 'candidate') reasons.push(candidateClass.reason)
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
  if (riskTerms.length > 0 || candidateClass.action === 'reject') {
    action = 'reject'
    label = '除外候補'
  } else if (!hasDemand) {
    action = 'reject'
    label = '需要未確認'
  } else if (candidateClass.action === 'explore') {
    action = 'expand'
    label = '入口ワード'
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
      structuralPenalty,
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
  return (normalized.sellingListingCount ?? 0) >= 2 || (normalized.medianMonthlySales ?? 0) >= 1
}

function hasDemandFromErank(normalized) {
  return (normalized.erankSearchVolume ?? 0) >= 300 || (normalized.erankClicks ?? 0) >= 100
}

function hasStrongDemand(normalized) {
  return (normalized.recentSellingListingCount ?? 0) >= 3
    || (normalized.medianMonthlySales ?? 0) >= 5
    || (normalized.erankSearchVolume ?? 0) >= 1000
    || (normalized.erankClicks ?? 0) >= 500
}

function competitionLevel(normalized) {
  const erankCompetition = normalized.erankCompetition
  const erankKeywordDifficulty = normalized.erankKeywordDifficulty
  const hasErankSupply = erankCompetition !== null || erankKeywordDifficulty !== null
  if ((erankKeywordDifficulty !== null && erankKeywordDifficulty <= 25)
    || (erankCompetition !== null && erankCompetition > 0 && erankCompetition < 5000)) {
    return 'low'
  }

  if ((erankKeywordDifficulty !== null && erankKeywordDifficulty <= 50)
    || (erankCompetition !== null && erankCompetition < 20000)) {
    return 'medium'
  }

  if (hasErankSupply) return 'high'
  if (['ultra-low', 'very-low', 'low'].includes(normalized.everbeeCompetitionBand)) return 'low'
  if (normalized.everbeeCompetitionBand === 'medium') return 'medium'
  if (['high', 'very-high', 'saturated'].includes(normalized.everbeeCompetitionBand)) return 'high'
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

const CATEGORY_ROUTE_SIGNALS = {
  shirt: ['shirt', 'tee', 'tshirt', 'funny', 'dad', 'mom', 'teacher', 'nurse', 'pickleball', 'dog mom', 'dog dad', 'retro', 'vintage'],
  sweatshirt: ['sweatshirt', 'crewneck', 'hoodie', 'cozy', 'fall', 'autumn', 'winter', 'christmas', 'halloween', 'teacher', 'nurse', 'embroidered', 'book lover'],
  mug: ['mug', 'coffee', 'cup', 'caffeine', 'teacher', 'nurse', 'coworker', 'boss', 'dad', 'mom', 'grandma', 'quote'],
  'wall-art': ['wall art', 'poster', 'print', 'art print', 'nursery', 'decor', 'room', 'aesthetic', 'quote', 'boho', 'minimalist', 'gallery'],
  tote: ['tote', 'bag', 'book lover', 'library', 'teacher', 'market', 'bridesmaid', 'bridal', 'eco', 'grocery'],
  sticker: ['sticker', 'planner', 'laptop', 'water bottle', 'cute', 'kawaii', 'book lover', 'teacher', 'vinyl'],
}

function routeSignalScore(keyword, categoryId) {
  const source = ` ${normalizePhrase(keyword)} `
  const signals = CATEGORY_ROUTE_SIGNALS[categoryId] ?? []
  return signals.reduce((score, signal) => {
    const term = normalizePhrase(signal)
    if (!term) return score
    return source.includes(` ${term} `) ? score + (term.includes(' ') ? 18 : 10) : score
  }, 0)
}

function routeReason(categoryId, keyword, score) {
  const normalized = score.normalized ?? {}
  const keywordText = normalizePhrase(keyword)
  if (categoryId === 'sweatshirt') return 'shirtが重い時の逃がし先。cozy/seasonal/apparel intent がある場合だけ再確認。'
  if (categoryId === 'wall-art') return 'decor/quote/aesthetic intent がある時の逃がし先。アパレル競合を避けやすい。'
  if (categoryId === 'mug') return 'gift/quote/workplace intent と相性がよく、制作コストを抑えやすい。'
  if (categoryId === 'sticker') return '低単価の趣味・planner・laptop intent向け。IP安全性が必須。'
  if (categoryId === 'tote') return 'book/teacher/market/bridal intent向け。縦長デザインと相性がよい。'
  if (keywordText.includes('shirt') || keywordText.includes('tee')) return 'shirt intent はあるため、eRankの供給と複数商品の販売を確認して判断。'
  return '現在のカテゴリ候補。'
}

export function recommendProductRoute(row = {}, scoreInput = null, options = {}) {
  const score = scoreInput?.normalized ? scoreInput : scoreEverbeeResult(row, options)
  const keyword = score.normalized.keyword
  const selectedCategory = getCategory(options.categoryId)
  const candidateClass = score.normalized.candidateClass ?? {}
  const riskBlocked = score.riskTerms.length > 0 || (candidateClass.unsupportedSearchTerms?.length ?? 0) > 0
  const productMismatch = candidateClass.action === 'reject' && Array.isArray(candidateClass.families) && candidateClass.families.length > 0
  const hasSalesProof = score.validation.hasEverbeeData && !score.gateReasons.includes('sales-breadth')
  const shirtSaturated = selectedCategory.id === 'shirt'
    && (score.gateReasons.includes('supply') || score.gateReasons.includes('sales-concentration'))

  if (riskBlocked) {
    return {
      decision: 'Do not use',
      summary: 'IP/固有名詞/競合などの理由で初心者向けには見送り。',
      primary: null,
      alternates: [],
      shirtSaturated,
      hasSalesProof,
    }
  }

  const scoredCategories = PRODUCT_CATEGORIES.map((category) => {
    const selectedBonus = category.id === selectedCategory.id ? 8 : 0
    const signalScore = routeSignalScore(keyword, category.id)
    const productFamilyBonus = keywordProductFamilies(keyword).includes(CATEGORY_PRODUCT_FAMILY[category.id]) ? 25 : 0
    const escapeBonus = shirtSaturated && category.id === 'sweatshirt' ? 18 : 0
    const wallArtEscape = shirtSaturated && category.id === 'wall-art' ? 10 : 0
    const saturationPenalty = category.id === 'shirt' && shirtSaturated ? 22 : 0
    const evidenceBonus = hasSalesProof && category.id === selectedCategory.id ? 12 : 0
    return {
      id: category.id,
      label: category.label,
      score: Math.max(0, signalScore + productFamilyBonus + selectedBonus + escapeBonus + wallArtEscape + evidenceBonus - saturationPenalty),
      reason: routeReason(category.id, keyword, score),
    }
  }).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'en'))

  const primary = scoredCategories[0]
  const alternates = scoredCategories.slice(1).filter((item) => item.score >= 10).slice(0, 2)
  let decision = 'Best first product'
  let summary = `${primary.label}で確認。`

  if (productMismatch && primary.id !== selectedCategory.id) {
    decision = 'Safer alternate'
    summary = `選択中の商品ではなく、まず${primary.label}で再確認。`
  } else if (!hasSalesProof) {
    decision = 'Needs sales proof'
    summary = '検索需要だけでは決めず、EverBeeでカテゴリ別の売上証拠を確認。'
  } else if (shirtSaturated && primary.id !== 'shirt') {
    decision = 'Safer alternate'
    summary = `shirtは重いので、まず${primary.label}で再確認。`
  } else if (!['A', 'B'].includes(score.opportunityLabel)) {
    decision = 'Watch / skip'
    summary = '需要・供給・複数商品販売のどれかが弱いため、無理に商品化しない。'
  }

  return {
    decision,
    summary,
    primary,
    alternates,
    shirtSaturated,
    hasSalesProof,
  }
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
  const productTokens = new Set([
    'shirt', 'shirts', 'tshirt', 'tshirts', 'tee', 'tees', 'top',
    'sweatshirt', 'sweatshirts', 'crewneck', 'crewnecks', 'hoodie', 'hoodies',
    ...PRODUCT_CATEGORIES.flatMap((item) => phraseTokens(item.searchTerm)),
  ])
  const titleStopWords = new Set(['gift', 'gifts', 'present', 'presents', 'perfect', 'for'])
  const strongestPhrase = unique(phrases).find((phrase) => normalizePhrase(phrase))
    ?? `${event.searchTerm} ${category.searchTerm}`
  const productWords = phraseTokens(category.searchTerm)
  const signalWords = phraseTokens(strongestPhrase)
    .filter((token) => !productTokens.has(token) && !titleStopWords.has(token))
  const maxSignalWords = Math.max(1, 14 - productWords.length)
  const titleWords = [...unique(signalWords).slice(0, maxSignalWords), ...productWords]
  return titleizeKeyword(titleWords.join(' '))
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
    ? [target, `${target} ${category.searchTerm}`]
    : []

  return unique([
    ...phrases.filter((phrase) => normalizePhrase(phrase).length <= 20),
    ...targetTags,
    event.searchTerm,
    category.searchTerm,
    ...category.tags.filter((tag) => !/\bgift\b/.test(normalizePhrase(tag))),
    ...phrases.flatMap(tagChunks),
  ])
    .map(cleanTag)
    .filter((tag) => tag.length >= 2 && tag.length <= 20)
    .filter((tag) => !/^\d{4}$/.test(tag))
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
      if (field === 'productRows' || field === 'sourceKeywords' || field === 'buyerIntentAxes') {
        try {
          const parsed = JSON.parse(value)
          row[field] = Array.isArray(parsed) ? parsed : []
        } catch {
          row[field] = field === 'productRows'
            ? []
            : splitSeedText(value)
        }
      } else if (field) {
        row[field] = value
      }
    })
    return row
  }).filter((row) => row.keyword)
}

export function rankResearchRows(rows = [], options = {}) {
  return rows
    .map((row) => {
      const score = scoreEverbeeResult(row, options)
      const idea = buildProductIdea(row.keyword, options)
      const productRoute = recommendProductRoute(row, score, options)
      return { ...row, score, idea, productRoute }
    })
    .sort((a, b) => b.score.score - a.score.score || normalizePhrase(a.keyword).localeCompare(normalizePhrase(b.keyword), 'en'))
}

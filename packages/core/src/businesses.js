/**
 * The provider table.
 *
 * Lifted out of app-preview.html so the UI and the server stop carrying
 * separate copies of it. Three fields still decide a business's availability
 * tier, and that is the point of the shape:
 *
 *   av            - the tier this business is in today
 *   icsUrl        - a calendar feed, the only thing that earns "live"
 *   declaredHours - hours they typed in themselves; indicative, never live
 *
 * Everything here is invented. See PREVIEW_DATA below before showing it to
 * anyone: a plausible name with a fabricated rating beside it is not a
 * harmless placeholder when a real Calgary business shares that name.
 */

/** True while the businesses, ratings and reviews are examples. */
export const PREVIEW_DATA = true;

export const BIZ=[
 {id:"maple",av:"unknown",vb:["id","biz","pay"],lg:["Korean","English"],n:"Maple Grove Property Group",nk:"메이플 그로브 부동산",c:"Rentals",ck:"렌탈",p:"$800-1,800/mo",r:4.9,rv:38,a:"NW Calgary",g:"g5",sc:"home",v:1,e:1,free:1,f:1,
  d:"Furnished rooms and townhouses near downtown. Bilingual leasing agent.",dk:"다운타운 근처 가구 완비 방과 타운하우스. 한국어 상담 가능."},
 {id:"sparkle",av:"connected",vb:["id","biz"],lg:["English","Tagalog"],n:"Sparkle Home Services",nk:"스파클 홈 서비스",c:"Cleaning",ck:"청소",p:"$100-220",r:4.7,rv:21,a:"SE Calgary",g:"g3",sc:"clean",v:1,e:0,free:1,f:1,
  d:"Deep cleans and move-out cleans. Same-week booking most weeks.",dk:"딥 클리닝과 이사 청소. 대부분 당주 예약 가능."},
 {id:"bright",av:"unknown",vb:["id","biz","lic","pay"],lg:["Korean","English","Mandarin"],n:"Bright Path Immigration",nk:"브라이트패스 이민상담",c:"Immigration",ck:"이민",p:"$300-2,000",r:4.8,rv:52,a:"City-wide",g:"g1",sc:"doc",v:1,e:1,free:0,f:1,
  d:"Licensed consultant. Work permits and permanent residence.",dk:"공인 컨설턴트. 취업 비자 및 영주권 상담."},
 {id:"haneul",av:"declared",vb:["id","biz","top"],lg:["Korean","English"],n:"Studio Haneul Hair",nk:"스튜디오 하늘 헤어",c:"Hair",ck:"미용",p:"$30-120",r:4.9,rv:64,a:"Downtown",g:"g2",sc:"hair",v:1,e:0,free:1,f:1,
  d:"Cuts, perms and colour. Korean and English spoken.",dk:"커트, 펌, 염색. 한국어와 영어 가능."},
 {id:"north",av:"declared",vb:["id","lic"],lg:["English","Mandarin"],n:"Northstar Learning",nk:"노스스타 학습센터",c:"Tutoring",ck:"과외",p:"$30-60/hr",r:4.8,rv:29,a:"NW Calgary",g:"g6",sc:"book",v:1,e:0,free:0,
  d:"Math and English tutoring, grades 4 to 12.",dk:"4학년부터 12학년까지 수학과 영어 과외."},
 {id:"truebuild",av:"unknown",vb:["id","biz","lic","ins","pay"],lg:["English","Punjabi"],n:"TrueBuild Renovations",nk:"트루빌드 리노베이션",c:"Renovation",ck:"리노베이션",p:"$2,000+",r:4.9,rv:44,a:"City-wide",g:"g4",sc:"tools",v:1,e:1,free:1,f:1,
  d:"Basement development and additions. Red Seal certified.",dk:"지하실 개발 및 증축. 레드씰 자격 보유."},
 {id:"riverbend",av:"declared",vb:["id","biz","lic","pay"],lg:["English","Tagalog"],n:"Riverbend Dental",nk:"리버벤드 치과",c:"Dental",ck:"치과",p:"$120-900",r:4.8,rv:47,a:"SW Calgary",g:"g5",sc:"tooth",v:1,e:1,free:1,f:1,
  d:"Checkups, cleanings and emergency visits. Direct billing to most plans.",dk:"검진, 스케일링, 응급 진료. 대부분의 보험 직접 청구."},
 {id:"hometable",av:"unknown",vb:["id","biz","ins"],lg:["Korean","Tagalog"],n:"Home Table Catering",nk:"홈테이블 케이터링",c:"Catering",ck:"케이터링",p:"$14-28/person",r:4.9,rv:33,a:"City-wide",g:"g4",sc:"food",v:1,e:1,free:0,f:1,
  d:"Korean and Filipino party trays. Two days notice for large orders.",dk:"한식과 필리핀식 파티 트레이. 대량 주문은 이틀 전 예약."},
 {id:"aurora",av:"declared",vb:["id","biz","ins"],lg:["Punjabi","English"],n:"Aurora Auto Repair",nk:"오로라 자동차 정비",c:"Auto",ck:"정비",p:"$90-1,200",r:4.7,rv:58,a:"NE Calgary",g:"g6",sc:"car",v:1,e:0,free:1,
  d:"Brakes, tires and out-of-province inspections. Free shuttle.",dk:"브레이크, 타이어, 타주 차량 검사. 무료 셔틀 운행."},
 {id:"bowriver",av:"connected",vb:["id","biz","lic","top"],n:"Bow River Family Clinic",nk:"보우리버 가정의학과",c:"Clinic",ck:"의원",p:"Covered by AHCIP",r:4.9,rv:71,a:"NW Calgary",g:"g3",sc:"clinic",lg:["Korean","English"],v:1,e:0,free:1,f:1,
  d:"Family doctor, walk-ins and same-week appointments. Korean-speaking staff.",dk:"가정의학과, 워크인 및 당주 예약. 한국어 가능 직원 상주."},
 {id:"crescent",av:"declared",vb:["id","biz","ins"],lg:["English","Tagalog"],n:"Crescent Clean Co.",nk:"크레센트 클린",c:"Cleaning",ck:"청소",p:"$90-190",r:4.6,rv:34,a:"NW Calgary",g:"g3",sc:"clean2",v:1,e:0,free:1,
  d:"Recurring home cleans, weekly or biweekly. Same team each visit.",dk:"주 1회 또는 격주 정기 청소. 매번 같은 팀이 방문합니다."},
 {id:"bowness",av:"unknown",vb:["id","biz","pay"],lg:["English","Punjabi"],n:"Bowness Rentals",nk:"보네스 렌탈",c:"Rentals",ck:"렌탈",p:"$1,100-2,400/mo",r:4.6,rv:52,a:"NW Calgary",g:"g5",sc:"home2",v:1,e:1,free:0,
  d:"Whole houses and duplexes. Pets considered on most units.",dk:"단독주택과 듀플렉스. 대부분 반려동물 상담 가능."},
 {id:"nova",av:"declared",vb:["id","biz"],lg:["English","Mandarin"],n:"Nova Hair Studio",nk:"노바 헤어 스튜디오",c:"Hair",ck:"미용",p:"$45-160",r:4.7,rv:41,a:"SE Calgary",g:"g2",sc:"hair2",v:1,e:0,free:1,
  d:"Colour specialists. Consultation before every first appointment.",dk:"염색 전문. 첫 방문 전 항상 상담을 진행합니다."},
 {id:"elbow",av:"declared",vb:["id","biz","lic"],lg:["English","Korean"],n:"Elbow Park Dental",nk:"엘보파크 치과",c:"Dental",ck:"치과",p:"$110-850",r:4.7,rv:63,a:"SW Calgary",g:"g5",sc:"tooth2",v:1,e:1,free:0,
  d:"Evenings and Saturdays. Nervous patients welcome.",dk:"저녁과 토요일 진료. 치과가 무서운 분도 편하게 오세요."},
 {id:"prairie",av:"declared",vb:["id","lic"],lg:["English","Punjabi"],n:"Prairie Tutors",nk:"프레리 튜터스",c:"Tutoring",ck:"과외",p:"$28-55/hr",r:4.6,rv:37,a:"SE Calgary",g:"g6",sc:"book2",v:1,e:0,free:1,
  d:"Small group sessions, grades 6 to 12. Diploma exam prep.",dk:"6~12학년 소그룹 수업. 졸업 시험 대비."},
 {id:"chinook",av:"unknown",vb:["id","biz","lic","pay"],lg:["Mandarin","English"],n:"Chinook Tax and Bookkeeping",nk:"치눅 세무회계",c:"Taxes",ck:"세무",p:"$80-450",r:4.8,rv:41,a:"SE Calgary",g:"g3",sc:"work",v:1,e:1,free:0,
  d:"Personal and small business returns. First consultation is free.",dk:"개인 및 소상공인 세금 신고. 첫 상담 무료."},
 /* Plumbing and Electrical exist because the bundle feature is built around
    trades that get called together. Two Korean-speaking options per service,
    not one: with a single candidate per trade the planner is a lookup, not a
    ranking. */
 {id:"hanriver",av:"connected",vb:["id","biz","lic","ins"],lg:["Korean","English"],n:"Han River Plumbing",nk:"한강 배관",c:"Plumbing",ck:"배관",p:"$120-600",r:4.8,rv:37,a:"NW Calgary",g:"g5",sc:"tools",v:1,e:1,free:1,f:1,
  d:"Licensed plumber. Leaks, drains and water heaters, same-week most weeks.",dk:"면허 배관공. 누수, 배수, 온수기. 대부분 당주 방문 가능."},
 {id:"taeyang",av:"declared",vb:["id","biz","lic"],lg:["Korean","English"],n:"Taeyang Plumbing and Heating",nk:"태양 배관 난방",c:"Plumbing",ck:"배관",p:"$110-540",r:4.6,rv:22,a:"NE Calgary",g:"g1",sc:"tools",v:1,e:0,free:0,f:1,
  d:"Plumbing and furnace work. Korean-speaking owner does the estimate himself.",dk:"배관 및 보일러 수리. 한국어 가능한 사장님이 직접 견적."},
 {id:"mirae",av:"connected",vb:["id","biz","lic","ins"],lg:["Korean","English"],n:"Mirae Electric",nk:"미래 전기",c:"Electrical",ck:"전기",p:"$130-700",r:4.9,rv:29,a:"SW Calgary",g:"g6",sc:"tools",v:1,e:1,free:1,f:1,
  d:"Licensed electrician. Panels, outlets and lighting. Permits handled.",dk:"면허 전기공. 배전반, 콘센트, 조명. 허가 대행."},
 {id:"voltway",av:"declared",vb:["id","biz","lic"],lg:["English","Korean"],n:"Voltway Electrical",nk:"볼트웨이 전기",c:"Electrical",ck:"전기",p:"$125-650",r:4.5,rv:18,a:"City-wide",g:"g4",sc:"tools",v:1,e:0,free:0,f:0,
  d:"Residential rewiring and inspections. Evening visits available.",dk:"주택 배선 및 점검. 저녁 방문 가능."},
 {id:"sarang",av:"declared",vb:["id","biz","top"],lg:["Korean","English"],n:"Sarang Cleaning",nk:"사랑 청소",c:"Cleaning",ck:"청소",p:"$90-200",r:4.8,rv:44,a:"NW Calgary",g:"g3",sc:"clean2",v:1,e:0,free:0,f:1,
  d:"Korean-speaking team. Regular and move-out cleans across the northwest.",dk:"한국어 가능한 팀. 정기 청소 및 이사 청소, 북서부 지역."}
];

export const CATS=[["Cleaning","청소","g3","clean"],["Rentals","렌탈","g5","home"],["Tutoring","과외","g6","book"],["Hair","미용","g2","hair"],
 ["Immigration","이민","g1","doc"],["Renovation","리노베이션","g4","tools"],["Dental","치과","g5","tooth"],["Catering","케이터링","g4","food"],
 ["Plumbing","배관","g5","tools"],["Electrical","전기","g6","tools"],["Auto","자동차","g1","car"],["Taxes","세무","g3","work"]];

/** Look up one business. Returns null rather than undefined, so a caller
    cannot accidentally treat a miss as a truthy object. */
export const byId = id => BIZ.find(b => b.id === id) || null;

export const byCategory = c => BIZ.filter(b => b.c === c);
export const categories = () => CATS.map(c => c[0]);

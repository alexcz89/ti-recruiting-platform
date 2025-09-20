// lib/skills.ts
export const ALL_SKILLS = [
  // Lenguajes
  "Python","Java","C","C++","C#","Go","Rust","Ruby","PHP","Kotlin","Swift","Dart",
  "Julia","Scala","R","Perl","Visual Basic .NET","Objective-C","Assembly","Zig",
  "HTML","CSS","XML","Markdown","LaTeX","Javascript",

  // Runtimes / frameworks backend
  "Node.js","Django","Flask","FastAPI","Spring Boot","ASP.NET","Ruby on Rails",
  "Laravel","Symfony","Express.js",".NET",

  // Mobile
  "React Native","Flutter","Xamarin","Ionic","Native Android (Java/Kotlin)","Native iOS (Swift/Objective-C)",

  // Data/AI/ML
  "TensorFlow","PyTorch","Keras","Scikit-Learn","OpenCV","Apache Spark (MLlib)",
  "Pandas","NumPy","Matplotlib","Seaborn","SciPy","Plotly","D3.js","MATLAB","Simulink","Simulink Test",

  // Cloud / DevOps
  "AWS","Microsoft Azure","Google Cloud Platform","Docker","Kubernetes","Terraform","Ansible","Chef","Puppet",
  "Jenkins","GitLab CI/CD","GitHub Actions","Bash","PowerShell",

  // DB / ORMs / Query
  "SQL","MySQL","PostgreSQL","Oracle","SQL Server","MongoDB","Cassandra","Couchbase","Redis","DynamoDB",
  "Prisma","Hibernate","SQLAlchemy","Entity Framework","GraphQL",

  // Testing
  "Selenium","Cypress","Puppeteer","JUnit","NUnit","PyTest","TestNG","Postman","Newman",

  // Hardware / HIL
  "LabVIEW","TestStand","VeriStand","dSPACE HIL","Vector CANoe","Arduino IDE","Raspberry Pi GPIO",
] as const;

// Bucket names en tu User
export type Bucket =
  | "frontend" | "backend" | "mobile" | "cloud" | "database"
  | "cybersecurity" | "testing" | "ai";

// Mapa rápido skill -> bucket
export const SKILL_TO_BUCKET: Record<string, Bucket> = {
  // Frontend
  "HTML":"frontend","CSS":"frontend","D3.js":"frontend","React Native":"mobile", // RN es mobile, lo dejamos aquí para claridad
  "Javascript":"frontend",

  // Backend / lenguajes genéricos
  "Python":"backend","Java":"backend","C":"backend","C++":"backend","C#":"backend","Go":"backend","Rust":"backend","Ruby":"backend","PHP":"backend",
  "Kotlin":"backend","Swift":"backend","Dart":"backend","Julia":"backend","Scala":"backend","R":"backend","Perl":"backend",
  "Visual Basic .NET":"backend","Objective-C":"backend","Assembly":"backend","Zig":"backend",".NET":"backend",

  "Node.js":"backend","Django":"backend","Flask":"backend","FastAPI":"backend","Spring Boot":"backend","ASP.NET":"backend","Ruby on Rails":"backend",
  "Laravel":"backend","Symfony":"backend","Express.js":"backend",

  // Mobile
  "Flutter":"mobile","Xamarin":"mobile","Ionic":"mobile","Native Android (Java/Kotlin)":"mobile","Native iOS (Swift/Objective-C)":"mobile",

  // AI / Data
  "TensorFlow":"ai","PyTorch":"ai","Keras":"ai","Scikit-Learn":"ai","OpenCV":"ai","Apache Spark (MLlib)":"ai",
  "Pandas":"ai","NumPy":"ai","Matplotlib":"ai","Seaborn":"ai","SciPy":"ai","Plotly":"ai","MATLAB":"ai","Simulink":"ai","Simulink Test":"ai",

  // Cloud / DevOps
  "AWS":"cloud","Microsoft Azure":"cloud","Google Cloud Platform":"cloud","Docker":"cloud",
  "Kubernetes":"cloud","Terraform":"cloud","Ansible":"cloud","Chef":"cloud","Puppet":"cloud",
  "Jenkins":"cloud","GitLab CI/CD":"cloud","GitHub Actions":"cloud","Bash":"cloud","PowerShell":"cloud",

  // DB
  "SQL":"database","MySQL":"database","PostgreSQL":"database","Oracle":"database","SQL Server":"database",
  "MongoDB":"database","Cassandra":"database","Couchbase":"database","Redis":"database","DynamoDB":"database",
  "Prisma":"database","Hibernate":"database","SQLAlchemy":"database","Entity Framework":"database","GraphQL":"database",

  // Testing
  "Selenium":"testing","Cypress":"testing","Puppeteer":"testing","JUnit":"testing","NUnit":"testing","PyTest":"testing",
  "TestNG":"testing","Postman":"testing","Newman":"testing",

  // Hardware / HIL
  "LabVIEW":"backend","TestStand":"backend","VeriStand":"backend","dSPACE HIL":"backend","Vector CANoe":"backend",
  "Arduino IDE":"backend","Raspberry Pi GPIO":"backend",

  // Markup / miscelánea
  "XML":"backend","Markdown":"backend","LaTeX":"backend",
};

// lib/skills.ts
// Fuente de catálogos (skills, certificaciones, idiomas) y helpers para UI.
// Lee de DB (TaxonomyTerm) con fallback a listas estáticas. ¡Server-only en las
// funciones que golpean Prisma (usamos dynamic import)!

// ──────────────────────────────────────────────────────────────────────────────
// FALLBACKS ESTÁTICOS (AMPLIADOS Y ORGANIZADOS)
// ──────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// LENGUAJES DE PROGRAMACIÓN
// ══════════════════════════════════════════════════════════════════════════════
const PROGRAMMING_LANGUAGES = [
  "Python","Java","C","C++","C#","Go","Rust","Ruby","PHP","Kotlin","Swift","Dart",
  "Julia","Scala","R","Perl","Visual Basic .NET","Objective-C","Assembly","Zig",
  "TypeScript","JavaScript","Shell Script","Bash","PowerShell","Elixir","Haskell",
  "Clojure","F#","Lua","MATLAB","Groovy","COBOL","Fortran",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// WEB DEVELOPMENT
// ══════════════════════════════════════════════════════════════════════════════
const WEB_FRONTEND = [
  "HTML","CSS","XML","Markdown","LaTeX",
  "JavaScript","TypeScript","React","Next.js","Vue.js","Nuxt","Angular",
  "Svelte","SvelteKit","Redux","RTK Query","Zustand","Jotai","Recoil",
  "Tailwind CSS","Bootstrap","Material UI","Ant Design","Chakra UI","shadcn/ui",
  "Vite","Webpack","Parcel","Rollup","esbuild","Babel","Storybook",
  "Jest","Vitest","Playwright","Cypress","Puppeteer","Testing Library",
  "ESLint","Prettier","D3.js","Chart.js","Recharts","Three.js","Babylon.js",
  "SASS/SCSS","LESS","PostCSS","Emotion","Styled Components",
] as const;

const WEB_BACKEND = [
  "Node.js","Express.js","NestJS","Fastify","Koa","Hapi",
  "Django","Flask","FastAPI","Celery",
  "Spring","Spring Boot","Micronaut","Quarkus",
  "ASP.NET Core",".NET","Entity Framework",
  "Ruby on Rails","Sinatra",
  "Laravel","Symfony","CodeIgniter","Slim",
  "Phoenix (Elixir)","Gin (Go)","Fiber (Go)","Echo (Go)","Chi (Go)",
  "GraphQL","Apollo Server","tRPC","gRPC","WebSockets","REST APIs",
  "OAuth2","JWT","Passport.js","NextAuth.js","Auth0","Clerk",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// MOBILE DEVELOPMENT
// ══════════════════════════════════════════════════════════════════════════════
const MOBILE = [
  "React Native","Expo",
  "Flutter","Dart",
  "SwiftUI","UIKit",
  "Kotlin Multiplatform Mobile","Jetpack Compose",
  "Xamarin","MAUI",
  "Ionic","Capacitor","Cordova",
  "Native Android (Java/Kotlin)","Native iOS (Swift/Objective-C)",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// DATA SCIENCE, AI/ML, ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
const AI_ML = [
  "TensorFlow","PyTorch","Keras","JAX","Scikit-Learn","XGBoost","LightGBM","CatBoost",
  "OpenCV","YOLO","Detectron2",
  "Apache Spark (MLlib)","Ray","Horovod",
  "Pandas","Polars","NumPy","Dask",
  "Matplotlib","Seaborn","Plotly","Altair","Bokeh",
  "SciPy","Statsmodels","NetworkX",
  "Jupyter","JupyterLab","Google Colab","Kaggle Notebooks",
  "MLflow","Weights & Biases","Neptune.ai","Comet.ml",
  "Hugging Face Transformers","LangChain","LlamaIndex","LangGraph",
  "OpenAI API","Anthropic API","Cohere","Vertex AI",
  "Vector DB (FAISS/PGVector/Pinecone/Weaviate/Milvus/Qdrant)",
  "Feature Stores (Feast/Tecton/Hopsworks)",
  "Computer Vision","Natural Language Processing (NLP)","Deep Learning",
  "Reinforcement Learning","Generative AI","Fine-tuning","Prompt Engineering",
  "ONNX","TensorRT","CoreML","TFLite",
] as const;

const DATA_ANALYTICS = [
  "SQL","BigQuery SQL","Snowflake SQL","Redshift SQL",
  "SAS","SAS Viya","SAS Enterprise Miner",
  "Tableau","Tableau Prep","Tableau Desktop","Tableau Server",
  "Power BI","Power Query","DAX","Power BI Service",
  "Looker","LookML","Looker Studio (Google Data Studio)",
  "Qlik Sense","QlikView","Qlik Replicate",
  "Sisense","ThoughtSpot","Mode Analytics","Metabase","Apache Superset","Redash",
  "Alteryx","Alteryx Designer","Alteryx Server",
  "KNIME","RapidMiner","Orange","Weka",
  "Databricks","Databricks SQL","Delta Lake","Unity Catalog",
  "dbt (Data Build Tool)","dbt Cloud","dbt Core",
  "Airflow","Apache NiFi","Luigi","Prefect","Dagster","Mage.ai",
  "Great Expectations","Soda","Monte Carlo Data",
  "ETL/ELT","Data Modeling","Data Warehousing","Data Pipeline",
  "Business Intelligence (BI)","Data Visualization","Statistical Analysis",
  "A/B Testing","Experimentation","Funnel Analysis","Cohort Analysis",
] as const;

const DATA_ENGINEERING = [
  "Apache Spark","PySpark","Spark SQL","Spark Streaming",
  "Apache Kafka","Kafka Streams","Kafka Connect","Confluent",
  "Apache Flink","Apache Beam","Apache Storm",
  "Apache Hadoop","HDFS","MapReduce","YARN","Hive","Pig","HBase",
  "Presto","Trino","Apache Drill","Apache Impala",
  "Apache Airflow","Apache Oozie","Apache Zookeeper",
  "Apache Parquet","Apache Avro","Apache ORC","Protocol Buffers",
  "Data Lake","Data Mesh","Data Fabric","Lakehouse Architecture",
  "Change Data Capture (CDC)","Debezium","Maxwell","Fivetran","Airbyte",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// CLOUD & DEVOPS
// ══════════════════════════════════════════════════════════════════════════════
const CLOUD_PLATFORMS = [
  // ── Multi-cloud / General
  "AWS","Microsoft Azure","Google Cloud Platform (GCP)","Oracle Cloud Infrastructure (OCI)",
  "IBM Cloud","Alibaba Cloud","DigitalOcean","Linode","Vultr","Hetzner Cloud",
  
  // ── AWS Services
  "EKS","ECS","Fargate","Lambda","EC2","Lightsail","Elastic Beanstalk",
  "S3","EBS","EFS","Glacier",
  "RDS","Aurora","DynamoDB","DocumentDB","ElastiCache","MemoryDB","Neptune","Timestream",
  "Athena","Glue","EMR","Kinesis","Redshift","Lake Formation",
  "API Gateway","AppSync","Step Functions","EventBridge","SQS","SNS",
  "CloudWatch","CloudTrail","X-Ray","Systems Manager",
  "CloudFormation","CDK (AWS)","SAM","Amplify",
  "IAM (AWS)","VPC (AWS)","Route 53","CloudFront","WAF (AWS)","Shield","Secrets Manager",
  "SageMaker","Bedrock","Rekognition","Comprehend","Polly","Transcribe",
  
  // ── GCP Services
  "GKE","Cloud Run","Cloud Functions","App Engine","Compute Engine",
  "BigQuery","BigTable","Spanner","Cloud SQL","Firestore","Memorystore",
  "Pub/Sub","Dataflow","Dataproc","Dataform","Composer (Airflow)",
  "Cloud Storage","Persistent Disk","Filestore",
  "Vertex AI","AI Platform","AutoML","Dialogflow","Vision AI","Natural Language AI",
  "IAM (GCP)","VPC (GCP)","Cloud Load Balancing","Cloud CDN","Cloud Armor",
  "Cloud Build","Cloud Deploy","Artifact Registry","Container Registry",
  "Cloud Monitoring","Cloud Logging","Cloud Trace","Error Reporting",
  
  // ── Azure Services
  "AKS","App Service","Functions (Azure)","Container Apps","Container Instances",
  "VM Scale Sets","Azure VMs","Azure Batch",
  "Azure SQL","Cosmos DB","Azure Database for PostgreSQL/MySQL/MariaDB",
  "Azure Cache for Redis","Azure Table Storage","Azure Data Lake Storage",
  "Event Hubs","Service Bus","Event Grid","Logic Apps",
  "Synapse Analytics","Data Factory","Databricks (Azure)","HDInsight","Stream Analytics",
  "Blob Storage","Azure Files","Managed Disks",
  "Azure Monitor","Application Insights","Log Analytics",
  "Azure DevOps","Azure Repos","Azure Pipelines","Azure Artifacts","Azure Test Plans",
  "ARM Templates","Bicep","Azure Resource Manager",
  "Azure AD (Entra ID)","Azure Key Vault","Azure Security Center","Azure Sentinel",
  "Azure Machine Learning","Cognitive Services","Azure OpenAI Service","Bot Service",
] as const;

const DEVOPS_TOOLS = [
  // ── Containers & Orchestration
  "Docker","Docker Compose","Podman","containerd","CRI-O",
  "Kubernetes","K3s","MicroK8s","kind","Minikube","Rancher","OpenShift",
  "Helm","Kustomize","Helmfile","Kpt",
  "Istio","Linkerd","Consul Connect","Envoy","NGINX Service Mesh",
  
  // ── CI/CD
  "Jenkins","Jenkins X","GitLab CI/CD","GitHub Actions","CircleCI","Travis CI",
  "TeamCity","Bamboo","Drone","Tekton","Argo Workflows","Concourse CI",
  "Argo CD","Flux CD","Spinnaker","Harness","Octopus Deploy",
  
  // ── IaC (Infrastructure as Code)
  "Terraform","Pulumi","Ansible","Chef","Puppet","SaltStack","Packer",
  "Vagrant","CloudFormation","CDK (AWS)","ARM/Bicep","Crossplane",
  
  // ── Observability & Monitoring
  "Prometheus","Grafana","Loki","Tempo","Mimir","Thanos","VictoriaMetrics",
  "OpenTelemetry","Jaeger","Zipkin","New Relic","Datadog","Dynatrace","AppDynamics",
  "ELK Stack (Elasticsearch/Logstash/Kibana)","EFK Stack (Elasticsearch/Fluentd/Kibana)",
  "Splunk","Sumo Logic","Graylog","Fluentd","Fluent Bit","Vector",
  "PagerDuty","Opsgenie","VictorOps","Sentry","Rollbar","Bugsnag",
  
  // ── Security & Secrets
  "HashiCorp Vault","AWS Secrets Manager","Azure Key Vault","Google Secret Manager",
  "Sealed Secrets","External Secrets Operator","SOPS","git-crypt",
  "Snyk","Trivy","Anchore","Grype","Clair","Aqua Security","Falco","OPA (Open Policy Agent)",
  
  // ── Networking & Load Balancing
  "NGINX","HAProxy","Traefik","Envoy","Caddy","Kong","Tyk",
  "Cloudflare","Akamai","Fastly","Amazon CloudFront",
  
  // ── Service Mesh & API Gateway
  "Istio","Linkerd","Consul","Envoy","NGINX Service Mesh",
  "Kong","Tyk","Apigee","AWS API Gateway","Azure API Management",
  
  // ── GitOps & SCM
  "Git","GitHub","GitLab","Bitbucket","Azure Repos","Gitea","Gogs",
  "ArgoCD","Flux","Fleet","Weave GitOps",
  
  // ── Platform Engineering
  "Backstage","Port","Kratix","Crossplane","KubeVela","Score",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// DATABASES & DATA STORAGE
// ══════════════════════════════════════════════════════════════════════════════
const DATABASES = [
  // ── Relational (SQL)
  "SQL","MySQL","PostgreSQL","Oracle Database","SQL Server","MariaDB","SQLite",
  "CockroachDB","YugabyteDB","TiDB","VoltDB",
  
  // ── NoSQL
  "MongoDB","Cassandra","Couchbase","CouchDB","RavenDB",
  "Redis","KeyDB","Memcached","Valkey",
  "DynamoDB","Azure Cosmos DB","Google Firestore","Google Bigtable",
  
  // ── Time-Series
  "InfluxDB","TimescaleDB","Prometheus (TSDB)","QuestDB","VictoriaMetrics",
  
  // ── Graph
  "Neo4j","ArangoDB","JanusGraph","Amazon Neptune","TigerGraph","OrientDB",
  
  // ── Vector / AI
  "Pinecone","Weaviate","Milvus","Qdrant","Chroma","FAISS","pgvector","Redis Vector",
  
  // ── Data Warehouses
  "Snowflake","BigQuery","Redshift","Synapse Analytics","Teradata",
  "Vertica","Exasol","ClickHouse","Apache Druid","StarRocks","Doris",
  
  // ── Search
  "Elasticsearch","OpenSearch","Solr","Algolia","Meilisearch","Typesense",
  
  // ── ORMs & Query Builders
  "Prisma","TypeORM","Drizzle ORM","MikroORM",
  "Hibernate","MyBatis","jOOQ","Spring Data JPA",
  "SQLAlchemy","Django ORM","Peewee","Pony ORM","Tortoise ORM",
  "Entity Framework","Dapper","NHibernate",
  "Sequelize","Mongoose","Knex.js","Objection.js","Bookshelf.js",
  "Active Record (Rails)","ROM.rb",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// CYBERSECURITY
// ══════════════════════════════════════════════════════════════════════════════
const CYBERSECURITY = [
  // ── Security Operations
  "SIEM (Security Information and Event Management)","SOC (Security Operations Center)",
  "IDS/IPS","WAF (Web Application Firewall)","DLP (Data Loss Prevention)",
  "EDR (Endpoint Detection and Response)","XDR (Extended Detection and Response)",
  "SOAR (Security Orchestration, Automation and Response)",
  
  // ── Application Security
  "OWASP Top 10","SAST (Static Application Security Testing)","DAST (Dynamic Application Security Testing)",
  "IAST (Interactive Application Security Testing)","SCA (Software Composition Analysis)",
  "Penetration Testing","Vulnerability Assessment","Security Code Review",
  "Burp Suite","OWASP ZAP","Metasploit","Nmap","Wireshark","Nessus","OpenVAS",
  "Snyk","Checkmarx","Veracode","Fortify","SonarQube (Security)",
  
  // ── Identity & Access
  "IAM (Identity and Access Management)","PAM (Privileged Access Management)",
  "OIDC","OAuth2","SAML","LDAP","Active Directory",
  "Single Sign-On (SSO)","Multi-Factor Authentication (MFA)","Zero Trust Architecture",
  "JWT","mTLS (Mutual TLS)","Certificate Management","PKI (Public Key Infrastructure)",
  
  // ── Cloud Security
  "CSPM (Cloud Security Posture Management)","CWPP (Cloud Workload Protection Platform)",
  "CASB (Cloud Access Security Broker)","Cloud Compliance (SOC2/ISO27001/HIPAA/PCI-DSS)",
  
  // ── Network Security
  "Firewall Configuration","VPN","IPSec","TLS/SSL","Network Segmentation",
  "DNS Security","DDoS Mitigation","Intrusion Detection","Threat Intelligence",
  
  // ── Container & K8s Security
  "Falco","Trivy","Snyk Container","Aqua Security","Twistlock (Prisma Cloud)",
  "Pod Security Standards","Network Policies","RBAC","OPA (Open Policy Agent)",
  
  // ── Incident Response
  "DFIR (Digital Forensics and Incident Response)","Threat Hunting","Malware Analysis",
  "Log Analysis","Security Monitoring","Incident Management",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// TESTING & QA
// ══════════════════════════════════════════════════════════════════════════════
const TESTING_QA = [
  // ── Frontend Testing
  "Jest","Vitest","Mocha","Jasmine","Karma",
  "React Testing Library","Vue Test Utils","Angular Testing",
  "Cypress","Playwright","Puppeteer","Selenium","WebdriverIO",
  "TestCafe","Nightwatch.js","CodeceptJS",
  
  // ── Backend Testing
  "JUnit","JUnit 5","TestNG","Mockito","PowerMock","WireMock",
  "PyTest","unittest","nose2","Robot Framework",
  "NUnit","xUnit","MSTest",
  "RSpec","Minitest","Capybara",
  "PHPUnit","Pest (PHP)",
  
  // ── API Testing
  "Postman","Newman","Insomnia","REST-assured","Karate DSL","Pact",
  "SoapUI","Hoppscotch","Bruno","HTTPie",
  
  // ── Performance Testing
  "JMeter","Gatling","K6","Locust","Artillery","Vegeta","wrk","ab (Apache Bench)",
  
  // ── Load Testing
  "BlazeMeter","Flood.io","Loader.io","LoadRunner",
  
  // ── Test Management
  "TestRail","Zephyr","qTest","PractiTest","Xray (Jira)",
  
  // ── BDD/TDD
  "Cucumber","SpecFlow","Behave","Behat","Gauge",
  "Test-Driven Development (TDD)","Behavior-Driven Development (BDD)",
  
  // ── Mobile Testing
  "Appium","Espresso","XCTest","XCUITest","Detox","Maestro",
  
  // ── Visual Testing
  "Percy","Applitools","Chromatic","BackstopJS","Playwright Visual Comparisons",
  
  // ── Accessibility Testing
  "axe DevTools","WAVE","Lighthouse","Pa11y","NVDA","JAWS","VoiceOver",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN & UX/UI
// ══════════════════════════════════════════════════════════════════════════════
const DESIGN_UX = [
  // ── Design Tools
  "Figma","Sketch","Adobe XD","InVision","Zeplin","Abstract","Marvel","Axure RP",
  "Framer","Framer Motion","Principle","ProtoPie","Origami Studio",
  "Adobe Photoshop","Adobe Illustrator","Adobe After Effects","Adobe Premiere Pro",
  "Affinity Designer","Affinity Photo","Canva","GIMP","Inkscape",
  "Blender","Cinema 4D","Maya","3ds Max","ZBrush",
  
  // ── Web Design & Prototyping
  "Webflow","Wix","Squarespace","WordPress (Design)","Elementor","Divi",
  
  // ── Design Systems & Tokens
  "Design Systems","Design Tokens","Style Dictionary","Figma Tokens","Storybook",
  "Atomic Design","Component Libraries","Pattern Libraries",
  
  // ── UX Research & Methods
  "User Research","Usability Testing","A/B Testing","Heuristic Evaluation",
  "User Interviews","Surveys","Card Sorting","Tree Testing","Eye Tracking",
  "Personas","User Journey Mapping","Service Design","Information Architecture",
  "Wireframing","Prototyping","User Flows","Task Analysis",
  
  // ── Accessibility
  "WCAG (Web Content Accessibility Guidelines)","ARIA (Accessible Rich Internet Applications)",
  "Section 508","ADA Compliance","Inclusive Design","Universal Design",
  
  // ── Motion & Animation
  "Lottie","Rive","Spine","GreenSock (GSAP)","Anime.js","Motion One",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// LOW-CODE / NO-CODE
// ══════════════════════════════════════════════════════════════════════════════
const LOW_CODE_NO_CODE = [
  // ── Enterprise Platforms
  "OutSystems","Mendix","Microsoft Power Apps","Power Automate","Power Platform",
  "Appian","ServiceNow App Engine","Salesforce Lightning Platform",
  "Oracle APEX","FileMaker","Zoho Creator","Quickbase",
  
  // ── Workflow Automation
  "Zapier","Make (Integromat)","n8n","Pipedream","Tray.io","Workato","Integromat",
  "IFTTT","Microsoft Power Automate","UiPath","Automation Anywhere","Blue Prism",
  
  // ── Web Builders
  "Webflow","Bubble.io","Wix","Squarespace","WordPress","Shopify","Framer Sites",
  
  // ── App Builders
  "Retool","Budibase","AppGyver (SAP Build)","Glide","Adalo","Thunkable","FlutterFlow",
  "Softr","Stacker","AppSheet (Google)","DronaHQ","Tooljet","Internal.io",
  
  // ── Database & Backend
  "Airtable","NocoDB","Baserow","Supabase","Firebase","Hasura","Xano","Backendless",
  
  // ── Analytics & BI
  "Tableau","Power BI","Looker Studio","Mode","Hex","Observable",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// GAME DEVELOPMENT
// ══════════════════════════════════════════════════════════════════════════════
const GAME_DEV = [
  // ── Engines
  "Unity","Unreal Engine","Godot","GameMaker Studio","CryEngine","Amazon Lumberyard",
  "Construct","Defold","Cocos2d","Phaser.js","PixiJS","PlayCanvas","Babylon.js","Three.js",
  
  // ── Programming
  "C# (Unity)","C++ (Unreal)","GDScript (Godot)","Blueprints (Unreal)","Lua (Game Dev)",
  
  // ── 3D Modeling & Animation
  "Blender","Maya","3ds Max","Cinema 4D","Houdini","ZBrush","Substance Painter","Substance Designer",
  
  // ── Game Design
  "Level Design","Game Mechanics","Narrative Design","Game Balancing","Monetization",
  
  // ── Multiplayer & Networking
  "Photon","Mirror","Netcode for GameObjects","Colyseus","Socket.IO (Games)","WebRTC (Games)",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// CMS & E-COMMERCE
// ══════════════════════════════════════════════════════════════════════════════
const CMS_ECOMMERCE = [
  // ── CMS (Content Management)
  "WordPress","Drupal","Joomla","TYPO3","Concrete CMS","Umbraco",
  "Strapi","Contentful","Sanity.io","Prismic","Directus","Payload CMS","KeystoneJS",
  "Ghost","Craft CMS","Statamic","Cockpit CMS","Butter CMS","Storyblok","DatoCMS",
  "Magnolia CMS","Sitecore","Adobe Experience Manager (AEM)","Kentico",
  
  // ── Headless CMS
  "Headless CMS","JAMstack","Static Site Generators",
  "Gatsby","Next.js","Nuxt","Hugo","Jekyll","11ty","Astro","Remix",
  
  // ── E-commerce
  "Shopify","Shopify Plus","Liquid (Shopify)","Shopify CLI","Shopify Hydrogen",
  "WooCommerce","Magento","Adobe Commerce","BigCommerce","PrestaShop","OpenCart",
  "Salesforce Commerce Cloud","SAP Commerce Cloud (Hybris)",
  "Saleor","Medusa","Vendure","Sylius","Reaction Commerce","Spree Commerce",
  "CommerceTools","Elastic Path","Vue Storefront","Swell",
  
  // ── Payment Processing
  "Stripe","PayPal","Square","Braintree","Adyen","Checkout.com","Klarna","Affirm",
  "Mercado Pago","OXXO Pay","Conekta","OpenPay",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// ELECTRÓNICA & HARDWARE
// ══════════════════════════════════════════════════════════════════════════════
const ELECTRONICS_HARDWARE = [
  // ── Diseño de Circuitos & PCB
  "Altium Designer","KiCad","Eagle (Autodesk)","OrCAD","Proteus","EasyEDA","DipTrace",
  "Fusion 360 Electronics","CircuitMaker","DesignSpark PCB","Fritzing",
  "PCB Design","Schematic Capture","PCB Layout","Gerber Files","Pick and Place",
  
  // ── Simulación & Análisis
  "SPICE","LTspice","Multisim","PSpice","TINA-TI","Ngspice","Qucs",
  "Circuit Simulation","Signal Integrity","Power Integrity","EMI/EMC Analysis",
  "ANSYS (Electronics)","CST Studio","HFSS","ADS (Advanced Design System)",
  
  // ── Microcontroladores & Embedded
  "Arduino","Raspberry Pi","ESP32","ESP8266","STM32","PIC Microcontroller","AVR",
  "ARM Cortex","Nordic nRF","Teensy","BeagleBone","NVIDIA Jetson",
  "Arduino IDE","PlatformIO","STM32CubeIDE","Keil","IAR Embedded Workbench",
  "Embedded C","Embedded C++","Assembly (Embedded)","MicroPython","CircuitPython",
  "RTOS (Real-Time Operating System)","FreeRTOS","Zephyr RTOS","Mbed OS","Arduino RTOS",
  
  // ── Comunicación & Protocolos
  "I2C","SPI","UART","CAN Bus","LIN","Modbus","RS-232","RS-485","USB","Ethernet",
  "MQTT","CoAP","LoRaWAN","Zigbee","Z-Wave","Thread","Matter","Bluetooth","BLE (Bluetooth Low Energy)",
  "Wi-Fi","NFC","RFID",
  
  // ── IoT & Edge Computing
  "IoT (Internet of Things)","Industrial IoT (IIoT)","Edge Computing","Fog Computing",
  "AWS IoT Core","Azure IoT Hub","Google Cloud IoT","ThingSpeak","Blynk","Adafruit IO",
  "Node-RED","Home Assistant","OpenHAB","ESPHome",
  
  // ── Sensores & Actuadores
  "Sensor Integration","IMU (Inertial Measurement Unit)","GPS/GNSS","Accelerometer","Gyroscope",
  "Temperature Sensors","Humidity Sensors","Pressure Sensors","Proximity Sensors","Ultrasonic Sensors",
  "LiDAR","Camera Integration","Servo Motors","Stepper Motors","DC Motors","Motor Drivers",
  
  // ── Robótica
  "ROS (Robot Operating System)","ROS2","Gazebo Simulator","Arduino Robotics",
  "Robot Kinematics","Path Planning","SLAM (Simultaneous Localization and Mapping)",
  "Computer Vision (Robotics)","Machine Learning (Robotics)",
  
  // ── FPGA & HDL
  "FPGA Programming","Verilog","VHDL","SystemVerilog","Vivado","Quartus Prime",
  "Xilinx","Intel FPGA","Lattice","ModelSim","GHDL",
  
  // ── Testing & Measurement
  "Oscilloscope","Logic Analyzer","Signal Generator","Spectrum Analyzer","Multimeter",
  "Soldering","SMD Soldering","Through-Hole","Reflow Oven","Hot Air Rework",
  "LabVIEW","TestStand","VeriStand","MATLAB (Hardware)","Simulink",
  "dSPACE HIL","Vector CANoe","Vector CANalyzer","National Instruments Hardware",
  
  // ── Power Electronics
  "Power Supply Design","SMPS (Switched-Mode Power Supply)","LDO Regulators","Buck Converter",
  "Boost Converter","Battery Management Systems (BMS)","Charging Circuits","Solar Power",
  
  // ── Manufacturing & Production
  "DFM (Design for Manufacturing)","DFT (Design for Test)","PCBA (PCB Assembly)",
  "SMT (Surface Mount Technology)","Automated Optical Inspection (AOI)","X-Ray Inspection",
  "Flying Probe Testing","In-Circuit Testing (ICT)","Boundary Scan (JTAG)",
  
  // ── Wireless & RF
  "RF Design","Antenna Design","Software-Defined Radio (SDR)","GNU Radio","HackRF",
  "LoRa","LoRaWAN","Sigfox","NB-IoT","5G (Hardware)",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// ERP & BUSINESS APPLICATIONS
// ══════════════════════════════════════════════════════════════════════════════
const ERP_BUSINESS = [
  // ── SAP
  "SAP ABAP","SAP HANA","SAP BW/BI","SAP Basis","SAP Fiori/UI5","SAP BAPI","SAP RFC",
  "SAP S/4HANA Finance (FI)","SAP S/4HANA Controlling (CO)","SAP MM (Sourcing & Procurement)",
  "SAP SD (Sales & Distribution)","SAP PP (Production Planning)","SAP QM (Quality Management)",
  "SAP PM (Plant Maintenance)","SAP WM/EWM (Warehouse Management)","SAP TM (Transportation Management)",
  "SAP HCM (Human Capital Management)","SAP SuccessFactors (Core)","SAP SuccessFactors Employee Central",
  "SAP SuccessFactors Recruiting","SAP SuccessFactors Performance & Goals","SAP SuccessFactors Learning",
  "SAP Ariba","SAP Fieldglass","SAP Concur","SAP IBP (Integrated Business Planning)",
  "SAP Solution Manager","SAP Cloud Platform (BTP)","SAP HANA Cloud","SAP Analytics Cloud",
  
  // ── Oracle
  "PL/SQL","Oracle Database Administration","Oracle RAC","Oracle GoldenGate","Oracle Data Guard",
  "Oracle APEX","Oracle Forms","Oracle Reports","Oracle Workflow",
  "Oracle E-Business Suite (EBS)","Oracle EBS Finance","Oracle EBS SCM","Oracle EBS HRMS",
  "Oracle Fusion Cloud ERP","Oracle Fusion Cloud HCM","Oracle Fusion Cloud SCM","Oracle Fusion Cloud CX",
  "Oracle NetSuite","NetSuite ERP","NetSuite CRM","NetSuite SuiteCommerce","NetSuite SuiteScript",
  "JD Edwards","PeopleSoft","Siebel CRM",
  "OCI (Oracle Cloud Infrastructure)","Oracle Autonomous Database","Oracle Exadata",
  
  // ── Salesforce
  "Salesforce Administration","Salesforce Apex","Salesforce Visualforce","SOQL","SOSL",
  "Salesforce Lightning (Aura Components)","Salesforce Lightning Web Components (LWC)",
  "Salesforce Flow","Salesforce Process Builder","Salesforce Workflow Rules",
  "Sales Cloud","Service Cloud","Marketing Cloud","Marketing Cloud Account Engagement (Pardot)",
  "Commerce Cloud","Experience Cloud (Community Cloud)","CPQ (Salesforce)","Billing (Salesforce)",
  "Field Service Lightning","Health Cloud","Financial Services Cloud","Manufacturing Cloud",
  "Salesforce Platform","Salesforce DX","Salesforce CLI","Salesforce Mobile SDK",
  "MuleSoft Anypoint Platform","Mule 4","MuleSoft API Manager","DataWeave","MUnit",
  "Heroku","Tableau (Salesforce)","Slack Integration",
  
  // ── Microsoft Dynamics
  "Microsoft Dynamics 365","Dynamics 365 Finance","Dynamics 365 Supply Chain Management",
  "Dynamics 365 Business Central","Dynamics 365 Sales","Dynamics 365 Customer Service",
  "Dynamics 365 Marketing","Dynamics 365 Field Service","Power Platform (Dynamics)",
  "X++ (Dynamics)","Dataverse","Model-Driven Apps","Canvas Apps",
  
  // ── Other ERP
  "Odoo","Odoo Development","Odoo Studio","Python (Odoo)","PostgreSQL (Odoo)",
  "Infor CloudSuite","IFS Applications","Epicor ERP","Sage X3","Sage Intacct",
  "Acumatica","SYSPRO","QAD","Plex Systems","Workday","Workday HCM","Workday Financials",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// CRM & MARKETING
// ══════════════════════════════════════════════════════════════════════════════
const CRM_MARKETING = [
  // ── CRM Platforms
  "Salesforce","HubSpot","HubSpot CRM","HubSpot Marketing Hub","HubSpot Sales Hub","HubSpot Service Hub",
  "Zoho CRM","Zoho One","Microsoft Dynamics 365 CRM","Pipedrive","Freshsales","Freshdesk",
  "Monday.com","Copper CRM","Insightly","Nimble","SugarCRM","Vtiger CRM",
  
  // ── Marketing Automation
  "Marketo","Eloqua (Oracle)","Pardot (Salesforce)","ActiveCampaign","Mailchimp","SendGrid",
  "Klaviyo","Brevo (Sendinblue)","GetResponse","Constant Contact","AWeber","Campaign Monitor",
  "Drip","ConvertKit","Omnisend","Moosend",
  
  // ── Marketing Analytics
  "Google Analytics","Google Analytics 4 (GA4)","Adobe Analytics","Mixpanel","Amplitude","Heap",
  "Segment","Rudderstack","mParticle","Tealium","Google Tag Manager","Adobe Launch",
  
  // ── SEO & SEM
  "SEO (Search Engine Optimization)","SEM (Search Engine Marketing)","Google Ads","Meta Ads (Facebook/Instagram)",
  "LinkedIn Ads","TikTok Ads","Twitter Ads","Snapchat Ads","Pinterest Ads",
  "Google Search Console","Bing Webmaster Tools","Ahrefs","SEMrush","Moz","Screaming Frog",
  "Keyword Research","Link Building","Technical SEO","Content Marketing","Copywriting",
  
  // ── Social Media Management
  "Hootsuite","Buffer","Sprout Social","Later","SocialBee","Agorapulse","CoSchedule",
  "Social Media Marketing","Community Management","Influencer Marketing",
  
  // ── Customer Success
  "Gainsight","ChurnZero","Totango","ClientSuccess","Customer Success Management","Onboarding",
  "NPS (Net Promoter Score)","CSAT (Customer Satisfaction)","Customer Health Scoring",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT MANAGEMENT & COLLABORATION
// ══════════════════════════════════════════════════════════════════════════════
const PROJECT_MANAGEMENT = [
  // ── Project Management Tools
  "Jira","Jira Software","Jira Service Management","Confluence","Trello","Asana","Monday.com",
  "ClickUp","Notion","Basecamp","Wrike","Smartsheet","Airtable","Coda",
  "Microsoft Project","Microsoft Planner","Azure DevOps Boards","Linear","Shortcut (Clubhouse)",
  "Pivotal Tracker","Teamwork","Zoho Projects","Workfront","Planview","LiquidPlanner",
  
  // ── Agile & Scrum
  "Scrum","Kanban","Lean","SAFe (Scaled Agile Framework)","LeSS","Nexus","Scrum@Scale",
  "Agile Coaching","Sprint Planning","Daily Standup","Sprint Review","Sprint Retrospective",
  "Backlog Refinement","Story Mapping","Velocity Tracking","Burndown Charts","Cumulative Flow Diagrams",
  
  // ── Methodologies
  "Waterfall","V-Model","Prince2","PMBOK","PMP","Agile","Extreme Programming (XP)",
  "Crystal","DSDM","Feature-Driven Development","Disciplined Agile (DA)",
  
  // ── Collaboration
  "Slack","Microsoft Teams","Discord","Zoom","Google Meet","Webex","Miro","Mural","FigJam",
  "Loom","Notion","Obsidian","Roam Research","Logseq",
  
  // ── Documentation
  "Technical Writing","API Documentation","Swagger/OpenAPI","ReadMe","GitBook","Docusaurus",
  "MkDocs","Sphinx","Javadoc","JSDoc","Doxygen","AsciiDoc",
  
  // ── Business Analysis
  "Business Analysis","Requirements Gathering","Requirements Management","Use Cases","User Stories",
  "Acceptance Criteria","Stakeholder Management","Process Mapping","BPMN (Business Process Model and Notation)",
  "Gap Analysis","Feasibility Study","SWOT Analysis","Cost-Benefit Analysis","ROI Analysis",
  "UML (Unified Modeling Language)","ER Diagrams","Data Flow Diagrams","Wireframes","Mockups",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// BLOCKCHAIN & WEB3
// ══════════════════════════════════════════════════════════════════════════════
const BLOCKCHAIN_WEB3 = [
  // ── Blockchain Platforms
  "Ethereum","Bitcoin","Solana","Polygon","Avalanche","Binance Smart Chain (BSC)","Cosmos",
  "Polkadot","Cardano","Algorand","Tezos","Near Protocol","Aptos","Sui","Hedera","Flow",
  
  // ── Smart Contracts & Development
  "Solidity","Vyper","Rust (Blockchain)","Move (Aptos/Sui)","Clarity (Stacks)",
  "Smart Contracts","Smart Contract Auditing","Smart Contract Security",
  "Hardhat","Truffle","Foundry","Brownie","Remix IDE","Ganache",
  
  // ── Web3 Libraries
  "Web3.js","Ethers.js","Viem","Wagmi","RainbowKit","ConnectKit","Web3Modal","WalletConnect",
  "Moralis","Alchemy","Infura","QuickNode","The Graph","Subgraph Development",
  
  // ── DeFi (Decentralized Finance)
  "DeFi","Uniswap","Aave","Compound","MakerDAO","Curve","Yearn Finance","Balancer",
  "DEX (Decentralized Exchange)","AMM (Automated Market Maker)","Liquidity Pools","Staking","Yield Farming",
  "Flash Loans","Lending Protocols","Stablecoins","Tokenomics",
  
  // ── NFTs & Digital Assets
  "NFT (Non-Fungible Token)","ERC-721","ERC-1155","ERC-20","BEP-20","Metadata Standards",
  "OpenSea","Rarible","Magic Eden","Blur","NFT Marketplaces","IPFS","Arweave","Filecoin",
  
  // ── DAOs & Governance
  "DAO (Decentralized Autonomous Organization)","Snapshot","Governance Tokens","Multisig Wallets","Gnosis Safe",
  
  // ── Security & Auditing
  "Blockchain Security","Reentrancy Attacks","Front-Running","MEV (Maximal Extractable Value)",
  "Slither","Mythril","Echidna","OpenZeppelin Contracts","OpenZeppelin Defender",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// NETWORKING & INFRASTRUCTURE
// ══════════════════════════════════════════════════════════════════════════════
const NETWORKING = [
  // ── Fundamentals
  "TCP/IP","UDP","HTTP/HTTPS","HTTP/2","HTTP/3","QUIC","WebSocket","gRPC","REST","GraphQL",
  "DNS","DHCP","NAT","PAT","ARP","ICMP","SNMP","NTP","LDAP",
  
  // ── Routing & Switching
  "BGP (Border Gateway Protocol)","OSPF","EIGRP","RIP","IS-IS","MPLS","VLAN","VTP","STP","RSTP",
  "Static Routing","Dynamic Routing","Route Redistribution","Policy-Based Routing",
  
  // ── Load Balancing
  "Load Balancing","Round Robin","Least Connections","IP Hash","Layer 4 Load Balancing","Layer 7 Load Balancing",
  "Global Server Load Balancing (GSLB)","Health Checks","Session Persistence",
  
  // ── CDN & Edge
  "CDN (Content Delivery Network)","Edge Computing","CloudFlare","Akamai","Fastly","Amazon CloudFront",
  "Azure CDN","Google Cloud CDN","Edge Functions","Edge Workers",
  
  // ── VPN & Remote Access
  "VPN (Virtual Private Network)","IPSec","OpenVPN","WireGuard","L2TP","PPTP","SSL VPN",
  "Site-to-Site VPN","Remote Access VPN","ZTNA (Zero Trust Network Access)","SD-WAN",
  
  // ── Wireless
  "Wi-Fi","802.11 Standards","Wi-Fi 6","Wi-Fi 6E","Wi-Fi 7","Wireless Controller","Access Point",
  "SSID","WPA2","WPA3","Wireless Security","Site Survey","Heat Mapping",
  
  // ── Network Security
  "Firewall","Next-Generation Firewall (NGFW)","ACL (Access Control List)","DMZ","Intrusion Detection (IDS)",
  "Intrusion Prevention (IPS)","Network Segmentation","Microsegmentation","VPC","Subnetting","CIDR",
  
  // ── Network Monitoring
  "Wireshark","tcpdump","Network Monitoring","Bandwidth Monitoring","NetFlow","sFlow","IPFIX",
  "Cacti","PRTG","Nagios","Zabbix","LibreNMS","Observium",
  
  // ── Cisco
  "Cisco IOS","Cisco NX-OS","Cisco ASA","Cisco Catalyst","Cisco Nexus","Cisco ACI","Cisco Meraki",
  "CCNA","CCNP Enterprise","CCNP Security","CCIE","Cisco DNA Center",
  
  // ── Other Vendors
  "Juniper Junos","Arista EOS","Palo Alto Networks","Fortinet FortiGate","Check Point","Aruba Networks",
  "Ubiquiti UniFi","MikroTik RouterOS",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// CERTIFICATIONS (AMPLIADAS)
// ══════════════════════════════════════════════════════════════════════════════
export const CERTIFICATIONS = [
  // ── AWS
  "AWS Certified Cloud Practitioner (CLF-C02)",
  "AWS Certified Solutions Architect – Associate (SAA-C03)",
  "AWS Certified Solutions Architect – Professional (SAP-C02)",
  "AWS Certified Developer – Associate (DVA-C02)",
  "AWS Certified SysOps Administrator – Associate (SOA-C02)",
  "AWS Certified DevOps Engineer – Professional (DOP-C02)",
  "AWS Certified Security – Specialty",
  "AWS Certified Advanced Networking – Specialty",
  "AWS Certified Data Engineer – Associate",
  "AWS Certified Machine Learning – Specialty",
  "AWS Certified Database – Specialty",

  // ── Microsoft Azure
  "Microsoft Azure Fundamentals (AZ-900)",
  "Microsoft Azure Administrator (AZ-104)",
  "Microsoft Azure Developer (AZ-204)",
  "Microsoft Azure Solutions Architect Expert (AZ-305)",
  "Microsoft Azure Security Engineer Associate (AZ-500)",
  "Microsoft Azure DevOps Engineer Expert (AZ-400)",
  "Microsoft Azure AI Fundamentals (AI-900)",
  "Microsoft Azure AI Engineer Associate (AI-102)",
  "Microsoft Azure Data Fundamentals (DP-900)",
  "Microsoft Azure Data Engineer Associate (DP-203)",
  "Microsoft Azure Data Scientist Associate (DP-100)",
  "Microsoft Azure Database Administrator Associate (DP-300)",

  // ── Google Cloud
  "Google Associate Cloud Engineer (ACE)",
  "Google Professional Cloud Architect",
  "Google Professional Data Engineer",
  "Google Professional Cloud Developer",
  "Google Professional Cloud DevOps Engineer",
  "Google Professional Cloud Security Engineer",
  "Google Professional Cloud Network Engineer",
  "Google Professional Machine Learning Engineer",
  "Google Professional Cloud Database Engineer",

  // ── Kubernetes & Cloud Native
  "CKA (Certified Kubernetes Administrator)",
  "CKAD (Certified Kubernetes Application Developer)",
  "CKS (Certified Kubernetes Security Specialist)",
  "KCNA (Kubernetes and Cloud Native Associate)",
  "KCSA (Kubernetes and Cloud Native Security Associate)",
  "Istio Certified Associate (ICA)",

  // ── IaC & DevOps Tools
  "Terraform Associate (003)",
  "HashiCorp Certified: Vault Associate",
  "HashiCorp Certified: Consul Associate",
  "GitHub Actions Certification",
  "GitLab Certified Associate",
  "Red Hat Certified Engineer (RHCE)",
  "Red Hat Certified Specialist in Ansible Automation",

  // ── Cisco Networking
  "CCNA (Cisco Certified Network Associate)",
  "CCNP Enterprise","CCNP Security","CCNP Data Center","CCNP Collaboration","CCNP Service Provider",
  "CCIE Enterprise Infrastructure","CCIE Security","CCIE Data Center",
  "Cisco DevNet Associate","Cisco DevNet Professional",

  // ── CompTIA
  "CompTIA A+","CompTIA Network+","CompTIA Security+","CompTIA Cloud+","CompTIA Linux+",
  "CompTIA CySA+ (Cybersecurity Analyst)","CompTIA PenTest+","CompTIA CASP+ (Advanced Security Practitioner)",

  // ── Security & Ethical Hacking
  "CEH (Certified Ethical Hacker)","OSCP (Offensive Security Certified Professional)",
  "OSWE (Offensive Security Web Expert)","OSEP (Offensive Security Experienced Penetration Tester)",
  "GIAC Security Essentials (GSEC)","GIAC Certified Incident Handler (GCIH)",
  "GIAC Web Application Penetration Tester (GWAPT)","GIAC Penetration Tester (GPEN)",
  "CISSP (Certified Information Systems Security Professional)",
  "CISM (Certified Information Security Manager)",
  "CISA (Certified Information Systems Auditor)",
  "CRISC (Certified in Risk and Information Systems Control)",

  // ── ITIL & Service Management
  "ITIL 4 Foundation","ITIL 4 Managing Professional","ITIL 4 Strategic Leader",
  "COBIT 2019 Foundation","COBIT 2019 Design and Implementation",

  // ── Project Management
  "PMP (Project Management Professional)","CAPM (Certified Associate in Project Management)",
  "PMI-ACP (Agile Certified Practitioner)","PMI-RMP (Risk Management Professional)",
  "Prince2 Foundation","Prince2 Practitioner","Prince2 Agile",
  "Scrum Master (CSM)","Professional Scrum Master (PSM I/II/III)","Professional Scrum Product Owner (PSPO I/II/III)",
  "SAFe Agilist (SA)","SAFe Scrum Master (SSM)","SAFe Product Owner/Product Manager (POPM)",
  "SAFe DevOps Practitioner (SDP)","SAFe Release Train Engineer (RTE)",
  "Lean Six Sigma Yellow Belt","Lean Six Sigma Green Belt","Lean Six Sigma Black Belt","Lean Six Sigma Master Black Belt",

  // ── Salesforce
  "Salesforce Administrator",
  "Salesforce Advanced Administrator",
  "Salesforce Platform App Builder",
  "Salesforce Platform Developer I",
  "Salesforce Platform Developer II",
  "Salesforce JavaScript Developer I",
  "Salesforce Sales Cloud Consultant",
  "Salesforce Service Cloud Consultant",
  "Salesforce Marketing Cloud Administrator",
  "Salesforce Marketing Cloud Email Specialist",
  "Salesforce Marketing Cloud Consultant",
  "Salesforce Experience Cloud Consultant",
  "Salesforce CPQ Specialist",
  "Salesforce Field Service Consultant",
  "Salesforce Architect – Application Architect",
  "Salesforce Architect – System Architect",
  "Salesforce Architect – Data Architect",
  "Salesforce Architect – B2C Commerce Architect",
  "MuleSoft Certified Developer – Level 1",
  "MuleSoft Certified Integration Architect – Level 1",

  // ── SAP
  "SAP Certified Development Associate – ABAP with SAP NetWeaver",
  "SAP Certified Technology Associate – System Administration (SAP HANA)",
  "SAP Certified Application Associate – SAP S/4HANA Finance",
  "SAP Certified Application Associate – SAP S/4HANA Sourcing and Procurement (MM)",
  "SAP Certified Application Associate – SAP S/4HANA Sales (SD)",
  "SAP Certified Application Associate – SAP S/4HANA Production Planning (PP)",
  "SAP Certified Application Associate – SAP SuccessFactors Employee Central",
  "SAP Certified Application Associate – SAP SuccessFactors Recruiting",
  "SAP Certified Application Associate – SAP HCM",
  "SAP Certified Application Associate – SAP Ariba Sourcing",
  "SAP Certified Technology Consultant – SAP HANA 2.0",
  "SAP Certified Development Specialist – SAP Fiori Application Developer",

  // ── Oracle
  "OCI Foundations Associate (1Z0-1085)",
  "OCI Architect Associate (1Z0-1072)",
  "OCI Architect Professional (1Z0-997)",
  "Oracle Database SQL Certified Associate (1Z0-071)",
  "Oracle Database Administration I (1Z0-082)",
  "Oracle Database Administration II (1Z0-083)",
  "Oracle Autonomous Database Cloud Specialist",
  "Oracle E-Business Suite R12.2 Financials",
  "Oracle Cloud Infrastructure 2023 Developer Professional",
  "Oracle NetSuite SuiteFoundation",
  "Oracle NetSuite ERP Consultant",

  // ── Data & Analytics
  "Tableau Desktop Specialist",
  "Tableau Certified Data Analyst",
  "Tableau Certified Consultant",
  "Microsoft Certified: Power BI Data Analyst Associate (PL-300)",
  "Google Data Analytics Professional Certificate",
  "Databricks Certified Data Engineer Associate",
  "Databricks Certified Data Engineer Professional",
  "Databricks Certified Machine Learning Associate",
  "Snowflake SnowPro Core Certification",
  "Snowflake SnowPro Advanced: Architect",
  "Snowflake SnowPro Advanced: Data Engineer",
  "dbt Analytics Engineering Certification",

  // ── AI & Machine Learning
  "TensorFlow Developer Certificate",
  "AWS Certified Machine Learning – Specialty",
  "Google Professional Machine Learning Engineer",
  "Microsoft Certified: Azure AI Engineer Associate (AI-102)",
  "Microsoft Certified: Azure Data Scientist Associate (DP-100)",
  "IBM Data Science Professional Certificate",
  "DeepLearning.AI TensorFlow Developer Professional Certificate",
  "Andrew Ng Machine Learning Specialization",

  // ── Programming & Development
  "Oracle Certified Professional: Java SE 11 Developer",
  "Oracle Certified Professional: Java SE 17 Developer",
  "Microsoft Certified: Azure Developer Associate (AZ-204)",
  "Microsoft Certified: Power Platform Developer Associate (PL-400)",
  "Unity Certified Programmer",
  "Meta Front-End Developer Professional Certificate",
  "Meta Back-End Developer Professional Certificate",

  // ── Business & Enterprise
  "Microsoft Dynamics 365 Fundamentals (MB-920)",
  "Microsoft Dynamics 365 Finance Functional Consultant (MB-310)",
  "Microsoft Dynamics 365 Supply Chain Management Functional Consultant (MB-330)",
  "Microsoft Power Platform Fundamentals (PL-900)",
  "Microsoft Power Platform Functional Consultant (PL-200)",
  "ServiceNow Certified System Administrator",
  "ServiceNow Certified Application Developer",
] as const;
export type Certification = (typeof CERTIFICATIONS)[number];

// ══════════════════════════════════════════════════════════════════════════════
// LANGUAGES
// ══════════════════════════════════════════════════════════════════════════════
export const LANGUAGES_FALLBACK = [
  "Inglés","Mandarín (Chino estándar)","Hindi","Español","Francés","Árabe (variedades)",
  "Bengalí","Ruso","Portugués","Urdu","Indonesio/Malayo","Alemán","Japonés","Nigerian Pidgin",
  "Maratí","Telugu","Turco","Tamil","Yue (Cantonés)","Italiano","Tailandés","Gujarati","Jin",
  "Persa (Farsi/Dari/Tayiko)","Vietnamita","Hausa","Egipcio árabe","Javanés",
  "Coreano","Punjabi occidental (Lahnda)","Wu (Shanghainés)","Bhojpuri","Polaco","Ucraniano",
  "Rumano","Neerlandés","Griego","Húngaro","Checo","Sueco","Catalán","Serbio","Búlgaro",
  "Hebreo","Danés","Finlandés","Noruego","Eslovaco",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// CONSOLIDACIÓN FINAL
// ══════════════════════════════════════════════════════════════════════════════
export const ALL_SKILLS = [
  ...PROGRAMMING_LANGUAGES,
  ...WEB_FRONTEND,
  ...WEB_BACKEND,
  ...MOBILE,
  ...AI_ML,
  ...DATA_ANALYTICS,
  ...DATA_ENGINEERING,
  ...CLOUD_PLATFORMS,
  ...DEVOPS_TOOLS,
  ...DATABASES,
  ...CYBERSECURITY,
  ...TESTING_QA,
  ...DESIGN_UX,
  ...LOW_CODE_NO_CODE,
  ...GAME_DEV,
  ...CMS_ECOMMERCE,
  ...ELECTRONICS_HARDWARE,
  ...ERP_BUSINESS,
  ...CRM_MARKETING,
  ...PROJECT_MANAGEMENT,
  ...BLOCKCHAIN_WEB3,
  ...NETWORKING,
] as const;
export type Skill = (typeof ALL_SKILLS)[number];

// ──────────────────────────────────────────────────────────────────────────────
export const SKILL_LEVELS = [
  { value: 1, label: "Básico" },
  { value: 2, label: "Junior" },
  { value: 3, label: "Intermedio" },
  { value: 4, label: "Avanzado" },
  { value: 5, label: "Experto" },
] as const;
export type SkillLevelValue = (typeof SKILL_LEVELS)[number]["value"];

export const LANGUAGE_LEVELS = [
  { value: "NATIVE", label: "Nativo" },
  { value: "PROFESSIONAL", label: "Profesional (C1–C2)" },
  { value: "CONVERSATIONAL", label: "Conversacional (B1–B2)" },
  { value: "BASIC", label: "Básico (A1–A2)" },
] as const;
export type LanguageLevelValue = (typeof LANGUAGE_LEVELS)[number]["value"];

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS DB
// ──────────────────────────────────────────────────────────────────────────────
export async function getSkillsFromDB(): Promise<string[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: "SKILL" },
      select: { label: true },
      orderBy: { label: "asc" },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...ALL_SKILLS];
  } catch {
    return [...ALL_SKILLS];
  }
}

export async function getCertificationsFromDB(): Promise<string[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: "CERTIFICATION" },
      select: { label: true },
      orderBy: { label: "asc" },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...CERTIFICATIONS];
  } catch {
    return [...CERTIFICATIONS];
  }
}

export async function getLanguagesFromDB(): Promise<string[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.taxonomyTerm.findMany({
      where: { kind: "LANGUAGE" },
      select: { label: true },
      orderBy: { label: "asc" },
    });
    return rows.map((r) => r.label).length ? rows.map((r) => r.label) : [...LANGUAGES_FALLBACK];
  } catch {
    return [...LANGUAGES_FALLBACK];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CLIENT HELPERS
// ──────────────────────────────────────────────────────────────────────────────
export function searchSkills(query: string, limit = 30): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ALL_SKILLS].slice(0, limit);
  return (ALL_SKILLS as readonly string[]).filter((s) => s.toLowerCase().includes(q)).slice(0, limit);
}

export function normalizeSkills(values: string[]): string[] {
  const set = new Set<string>();
  const catalogLC = new Map((ALL_SKILLS as readonly string[]).map((s) => [s.toLowerCase(), s]));
  for (const raw of values) {
    const t = (raw || "").trim();
    if (!t) continue;
    const matched = catalogLC.get(t.toLowerCase());
    set.add(matched ?? t);
  }
  return Array.from(set);
}

// ──────────────────────────────────────────────────────────────────────────────
// EMPLEO
// ──────────────────────────────────────────────────────────────────────────────
export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Tiempo completo" },
  { value: "PART_TIME", label: "Medio tiempo" },
  { value: "CONTRACT", label: "Por periodo / Contrato" },
  { value: "INTERNSHIP", label: "Prácticas profesionales" },
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];

export const SENIORITY_OPTIONS = [
  { value: "JUNIOR", label: "Junior" },
  { value: "MID", label: "Mid" },
  { value: "SENIOR", label: "Senior" },
  { value: "LEAD", label: "Lead" },
] as const;
export type Seniority = (typeof SENIORITY_OPTIONS)[number]["value"];

export const LOCATION_TYPES = [
  { value: "REMOTE", label: "Remoto" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "ONSITE", label: "Presencial" },
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number]["value"];

export const CURRENCIES = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number]["value"];

export const labelForEmploymentType = (v?: string) =>
  EMPLOYMENT_TYPES.find((x) => x.value === v)?.label ?? v ?? "";
export const labelForSeniority = (v?: string) =>
  SENIORITY_OPTIONS.find((x) => x.value === v)?.label ?? v ?? "";
export const labelForLocationType = (v?: string) =>
  LOCATION_TYPES.find((x) => x.value === v)?.label ?? v ?? "";

// ──────────────────────────────────────────────────────────────────────────────
// BUCKETS (AMPLIADOS)
// ──────────────────────────────────────────────────────────────────────────────
export type Bucket =
  | "frontend" | "backend" | "mobile" | "cloud" | "devops" | "database" | "cybersecurity"
  | "testing" | "ai" | "data" | "design" | "electronics" | "sap" | "oracle" | "salesforce"
  | "blockchain" | "networking" | "gamedev" | "ecommerce" | "lowcode" | "projectmgmt";

export const SKILL_TO_BUCKET: Record<string, Bucket> = {
  // Frontend
  HTML: "frontend", CSS: "frontend", JavaScript: "frontend", TypeScript: "frontend",
  React: "frontend", "Next.js": "frontend", "Vue.js": "frontend", Vue: "frontend", Nuxt: "frontend",
  Angular: "frontend", Svelte: "frontend", SvelteKit: "frontend", Redux: "frontend",
  "Tailwind CSS": "frontend", Bootstrap: "frontend", "Material UI": "frontend",
  "D3.js": "frontend", "Three.js": "frontend", "Babylon.js": "frontend",

  // Backend
  "Node.js": "backend", "Express.js": "backend", NestJS: "backend", Python: "backend", Django: "backend",
  Flask: "backend", FastAPI: "backend", Java: "backend", Spring: "backend", "Spring Boot": "backend",
  Go: "backend", Rust: "backend", Ruby: "backend", "Ruby on Rails": "backend", PHP: "backend",
  Laravel: "backend", ".NET": "backend", "ASP.NET Core": "backend", GraphQL: "backend", "gRPC": "backend",

  // Mobile
  "React Native": "mobile", Flutter: "mobile", SwiftUI: "mobile", Kotlin: "mobile",
  "Native Android (Java/Kotlin)": "mobile", "Native iOS (Swift/Objective-C)": "mobile",

  // AI & Data
  TensorFlow: "ai", PyTorch: "ai", Keras: "ai", "Scikit-Learn": "ai", OpenCV: "ai",
  Pandas: "data", NumPy: "data", "Apache Spark (MLlib)": "data", Databricks: "data",
  Tableau: "data", "Power BI": "data", Snowflake: "data", BigQuery: "data", dbt: "data",

  // Cloud & DevOps
  AWS: "cloud", "Microsoft Azure": "cloud", "Google Cloud Platform (GCP)": "cloud",
  Docker: "devops", Kubernetes: "devops", Terraform: "devops", Ansible: "devops",
  Jenkins: "devops", "GitLab CI/CD": "devops", "GitHub Actions": "devops",
  Prometheus: "devops", Grafana: "devops", "Argo CD": "devops",

  // Databases
  SQL: "database", PostgreSQL: "database", MySQL: "database", MongoDB: "database",
  Redis: "database", Elasticsearch: "database", Cassandra: "database",

  // Cybersecurity
  SIEM: "cybersecurity", SOC: "cybersecurity", WAF: "cybersecurity", OWASP: "cybersecurity",
  "Burp Suite": "cybersecurity", Metasploit: "cybersecurity",

  // Testing
  Jest: "testing", Cypress: "testing", Playwright: "testing", Selenium: "testing",
  JMeter: "testing", Postman: "testing",

  // Design
  Figma: "design", Sketch: "design", "Adobe XD": "design", Photoshop: "design",

  // Electronics
  Arduino: "electronics", "Raspberry Pi": "electronics", ESP32: "electronics", STM32: "electronics",
  KiCad: "electronics", "Altium Designer": "electronics", FPGA: "electronics", Verilog: "electronics",

  // SAP
  "SAP ABAP": "sap", "SAP HANA": "sap", "SAP Fiori/UI5": "sap", "SAP S/4HANA Finance (FI)": "sap",

  // Oracle
  "PL/SQL": "oracle", "Oracle Database Administration": "oracle", "Oracle E-Business Suite (EBS)": "oracle",
  "Oracle Fusion Cloud ERP": "oracle",

  // Salesforce
  "Salesforce Administration": "salesforce", "Salesforce Apex": "salesforce",
  "Salesforce Lightning (Aura Components)": "salesforce", "MuleSoft Anypoint Platform": "salesforce",

  // Blockchain
  Solidity: "blockchain", "Ethers.js": "blockchain", Ethereum: "blockchain",

  // Networking
  "TCP/IP": "networking", DNS: "networking", VPN: "networking", BGP: "networking",

  // Game Dev
  Unity: "gamedev", "Unreal Engine": "gamedev", Godot: "gamedev",

  // E-commerce
  Shopify: "ecommerce", WooCommerce: "ecommerce", Magento: "ecommerce",

  // Low-Code
  OutSystems: "lowcode", Mendix: "lowcode", "Power Apps": "lowcode",

  // Project Management
  Jira: "projectmgmt", Confluence: "projectmgmt", Scrum: "projectmgmt", Kanban: "projectmgmt",
};
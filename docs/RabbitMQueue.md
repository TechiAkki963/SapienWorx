# Master Architecture Prompt: RabbitMQ CV Parser Configuration

**Objective:** Implement an asynchronous, resilient RabbitMQ messaging topology within the Spring Boot backend to handle deterministic CV parsing. The architecture must prioritise live candidate onboarding over recruiter bulk uploads and gracefully route failures to a Dead Letter Queue (DLQ).

---

## 1. RabbitMQ Topology & Queues

The backend team must configure a Direct Exchange with three distinct queues to strictly enforce our processing priorities and error handling.

- **Exchange:** `cv.parser.exchange` (Type: Direct)
- **High-Priority Queue:** `cv.parser.candidate.queue` (Routing Key: `parse.candidate`) - Reserved exclusively for live candidate onboarding.
- **Standard Queue:** `cv.parser.bulk.queue` (Routing Key: `parse.bulk`) - Utilised for recruiter multi-CV uploads.
- **Dead Letter Queue (DLQ):** `cv.parser.dlq` (Routing Key: `parse.dlq`) - Catches messages that fail processing after maximum retry attempts.

---

## 2. Spring Boot Configuration (AMQP)

The engineering team must map this topology precisely within a Spring `@Configuration` class to ensure the DLQ is properly bound to the primary processing queues.

\`\`\`java
import org.springframework.amqp.core.\*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "cv.parser.exchange";
    public static final String CANDIDATE_QUEUE = "cv.parser.candidate.queue";
    public static final String BULK_QUEUE = "cv.parser.bulk.queue";
    public static final String DEAD_LETTER_QUEUE = "cv.parser.dlq";

    @Bean
    public DirectExchange parserExchange() {
        return new DirectExchange(EXCHANGE_NAME);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    public Queue candidateQueue() {
        return QueueBuilder.durable(CANDIDATE_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_QUEUE)
                .build();
    }

    @Bean
    public Queue bulkQueue() {
        return QueueBuilder.durable(BULK_QUEUE)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_QUEUE)
                .build();
    }

    @Bean
    public Binding candidateBinding(Queue candidateQueue, DirectExchange parserExchange) {
        return BindingBuilder.bind(candidateQueue).to(parserExchange).with("parse.candidate");
    }

    @Bean
    public Binding bulkBinding(Queue bulkQueue, DirectExchange parserExchange) {
        return BindingBuilder.bind(bulkQueue).to(parserExchange).with("parse.bulk");
    }

}
\`\`\`

---

## 3. The Asynchronous Worker (Listener)

The worker service must listen to these queues asynchronously. It will extract the text using our deterministic libraries, update the database, and dispatch an event back to the Next.js frontend via Server-Sent Events (SSE).

\`\`\`java
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class CvParserWorker {

    // Listens to the high-priority candidate queue
    @RabbitListener(queues = RabbitMQConfig.CANDIDATE_QUEUE, concurrency = "2-5")
    public void processCandidateCv(ParserPayload payload) {
        log.info("Processing high-priority CV for candidate ID: {}", payload.getCandidateId());
        try {
            // 1. Fetch file from S3 bucket using payload.getFileKey()
            // 2. Execute deterministic text extraction (PDFBox / Apache POI)
            // 3. Map extracted text to structured profile data
            // 4. Save to PostgreSQL via JPA repository
            // 5. Trigger SSE event to Next.js frontend (e.g., CV_PARSING_COMPLETE)
        } catch (Exception e) {
            log.error("Parsing failed for candidate ID: {}. Routing to DLQ.", payload.getCandidateId());
            throw new AmqpRejectAndDontRequeueException("Deterministic parsing failed", e);
        }
    }

    // Listens to the lower-priority bulk queue with lower concurrency
    @RabbitListener(queues = RabbitMQConfig.BULK_QUEUE, concurrency = "1-2")
    public void processBulkCv(ParserPayload payload) {
        log.info("Processing bulk CV upload for recruiter job ID: {}", payload.getJobId());
        // Implementation mirrors candidate logic, but updates recruiter pipeline records.
    }

}
\`\`\`

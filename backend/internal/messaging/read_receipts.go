package messaging

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// MarkMessagesRead performs one bounded UPDATE for a viewport batch and returns
// only rows that actually transitioned false -> true. This keeps read receipts
// idempotent and avoids write amplification on the small PostgreSQL instance.
func (s *Service) MarkMessagesRead(ctx context.Context, threadID, readerID string, messageIDs []string) ([]ReadResult, error) {
	if len(messageIDs) == 0 || len(messageIDs) > MaxReadReceiptBatch {
		return nil, ErrInvalidInput
	}
	if _, err := s.authorizeThread(ctx, threadID, readerID); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(ctx, `
		UPDATE chat_messages
		SET is_read=true
		WHERE thread_id=$1
		  AND sender_id<>$2
		  AND is_read=false
		  AND id=ANY($3::uuid[])
		RETURNING sender_id,id
	`, threadID, readerID, messageIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bySender := make(map[string][]string, 1)
	for rows.Next() {
		var senderID, messageID string
		if err := rows.Scan(&senderID, &messageID); err != nil {
			return nil, err
		}
		bySender[senderID] = append(bySender[senderID], messageID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	results := make([]ReadResult, 0, len(bySender))
	for senderID, ids := range bySender {
		results = append(results, ReadResult{SenderID: senderID, MessageIDs: ids})
	}
	return results, nil
}

// MarkThreadRead preserves the REST endpoint semantics while avoiding a second
// authorization round-trip. It updates only unread messages from the other
// participant.
func (s *Service) MarkThreadRead(ctx context.Context, threadID, readerID string) error {
	thread, err := s.authorizeThread(ctx, threadID, readerID)
	if err != nil {
		return err
	}
	if readerID != thread.RecruiterID && readerID != thread.CandidateID {
		return ErrForbidden
	}
	_, err = s.db.Exec(ctx, `UPDATE chat_messages SET is_read=true WHERE thread_id=$1 AND sender_id<>$2 AND is_read=false`, threadID, readerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	return err
}

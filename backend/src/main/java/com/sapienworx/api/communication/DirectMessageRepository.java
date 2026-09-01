package com.sapienworx.api.communication;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DirectMessageRepository extends JpaRepository<DirectMessage, UUID> {
    void deleteBySenderIdOrRecipientId(UUID senderId, UUID recipientId);
    @Query("""
            select message from DirectMessage message
            where (message.senderId = :firstUser and message.recipientId = :secondUser)
               or (message.senderId = :secondUser and message.recipientId = :firstUser)
            order by message.sentAt asc
            """)
    Page<DirectMessage> conversation(@Param("firstUser") UUID firstUser, @Param("secondUser") UUID secondUser, Pageable pageable);
    @Query("""
            select message from DirectMessage message
            where (message.senderId = :firstUser and message.recipientId = :secondUser)
               or (message.senderId = :secondUser and message.recipientId = :firstUser)
            order by message.sentAt desc
            """)
    List<DirectMessage> recentConversation(@Param("firstUser") UUID firstUser, @Param("secondUser") UUID secondUser, Pageable pageable);
    long countBySenderIdAndRecipientIdAndReadAtIsNull(UUID senderId, UUID recipientId);
    Page<DirectMessage> findByRecipientIdOrderBySentAtDesc(UUID recipientId, Pageable pageable);
    List<DirectMessage> findBySenderIdOrRecipientIdOrderBySentAtDesc(UUID senderId, UUID recipientId);
}

export function getMeaningfulMessageCount(history: any[] = []) {
    return history.reduce((count, item) => {
        // ❌ System messages (handoff lifecycle)
        if (item.systemMessage) return count;
        if (item.type?.startsWith("handoff_")) return count;

        /**
         * ======================
         * FLOW
         * ======================
         */

        if (item.mode === "flow") {

            if (item.type === "message") {
                return count + 1;
            }

            if (item.type === "code") {
                return count + 1;
            }

            // Question / Confirmation / Branch PROMPT
            if (
                ["question", "confirmation", "branch"].includes(item.type) &&
                item.awaitingInput === true
            ) {
                return count + 1; // the question
            }

            // User answers
            if (
                item.type === "user_input" ||
                item.fromUser === true
            ) {
                return count + 1; // the answer
            }

            if (
                ["question", "confirmation"].includes(item.type) &&
                item.fromUser === true
            ) {
                return count + 1;
            }

            return count;
        }

        /**
         * ======================
         * QA
         * ======================
         */
        if (item.mode === "qa") {
            return count + 2; // question + answer
        }

        /**
         * ======================
         * HANDOFF
         * ======================
         */
        if (
            item.mode === "handoff" &&
            (item.sender === "user" || item.sender === "agent")
        ) {
            return count + 1;
        }

        return count;
    }, 0);
}
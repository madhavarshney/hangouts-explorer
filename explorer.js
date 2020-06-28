const intro = document.querySelector('.intro');
const input = document.querySelector('input[type="file"]');
const aside = document.querySelector('aside .list');
const chatView = document.querySelector('main .messages');
const chatTitle = document.querySelector('main .chat-title');

dayjs.extend(dayjs_plugin_calendar);

input.addEventListener('change', () => {
    if (input.files && input.files.length > 0) {
        const file = input.files[0];

        if (file) {
            input.classList.add('loading');

            const reader = new FileReader();
            reader.readAsText(file, "UTF-8");
            reader.onload = (event) => {
                let data;
                try {
                    data = JSON.parse(event.target.result);
                } catch (error) {
                    console.warn(error);
                    alert("Unable to parse the file! Are you sure it was a .json file and contained valid JSON?");
                } finally {
                    input.classList.remove('loading');
                }
                processData(data);
            };
            reader.onerror = (event) => {
                console.warn(event);
                alert("There was an error reading the file! Something wen't wrong, although I'm not sure what. Maybe, check the file or try again?");
            };
        }
    }
});

function processData(data) {
    const { conversations } = data;

    const chats = [];
    const messages = {};
    const allPeople = {};

    for (const convo of conversations) {
        const { participant_data: participants } = convo['conversation']['conversation'];

        for (const person of participants) {
            const id = person['id']['gaia_id'];
            allPeople[id] = {
                name: person['fallback_name'] || 'Unknown',
            };
        }
    }

    for (const convo of conversations) {
        const { conversation: { conversation: meta }, events } = convo;
        const participants = meta['participant_data'];
        const { id } = meta.id;
        const people = {};
        const msgs = [];

        for (const person of participants) {
            const id = person['id']['gaia_id'];
            people[id] = {
                name: person['fallback_name'] || 'Unknown',
            };
        }

        for (const event of events) {
            const {
                timestamp,
                sender_id: { gaia_id: senderId },
                chat_message: chatMessage,
            } = event;

            let text = '';

            if (chatMessage) {
                const segments = chatMessage['message_content']['segment'];

                if (!segments) continue;

                // Get message
                for (const segment of segments) {
                    if (segment['type'] == 'LINE_BREAK') text += "\n";
                    if (segment['text']) text += twemoji.parse(segment['text']);
                }

                msgs.push({
                    sender: people[senderId] || allPeople[senderId],
                    timestamp,
                    // time: dayjs(timestamp / 1000).calendar(),
                    text,
                });
            }
        }

        msgs.sort((a, b) => {
            if (a.timestamp < b.timestamp) return -1;
            if (a.timestamp > b.timestamp) return 1;
            return 0;
        });

        if (!meta.name) {
            let str = [];
            let folks = Object.values(people);
            for (const p of folks) {
                if (str.length > 2) {
                    str.push(`${folks.length - 1} more`);
                    break;
                }
                str.push(p.name);
            }
            meta.name = str.join(', ');
        }

        chats.push({
            id,
            type: meta.type,
            title: meta.name,
            people,
            lastMessage: msgs[msgs.length - 1],
        });

        messages[id] = msgs;
    };

    populateUI(chats.reverse(), messages);
}

function el(tagName) {
    return document.createElement(tagName);
}

function ListItem(name, id, lastMessage) {
    const item = el('div');
    item.id = id;
    item.className = 'item';
    item.innerHTML = `
        <div class="title">${name}</div>
        <div class="last-message">${lastMessage.text}</div>
    `;
    item.addEventListener('click', () => loadChat(id));
    return item;
}

let theChats = null;
let theMessages = null;
let selectedChatId = null;

function populateUI(chats, messages) {
    theChats = chats;
    theMessages = messages;
    document.body.setAttribute('data-page', 'chats');
    for (const { title, id, lastMessage, people } of chats) {
        const info = `${Object.keys(people).length} people • ${theMessages[id].length} messages`;
        aside.appendChild(ListItem(title, id, { text: info }));
    }
}

function loadChat(id) {
    if (selectedChatId) {
        const previousItem = document.getElementById(selectedChatId);
        previousItem && previousItem.classList.remove('active');
    }
    selectedChatId = id;
    document.getElementById(id).classList.add('active');

    const messages = theMessages[id];
    const rendered = messages.map(({ text, sender, timestamp }) => {
        const time = dayjs(timestamp / 1000).calendar();
        const item = el('div');
        item.className = 'message';
        item.innerHTML = `
            <div class="content">
                <div class="sub">${(sender && sender.name) || 'Unknown'} • ${time}</div>
                ${text}
            </div>
        `;
        return item;
    });

    chatTitle.innerText = theChats.find((c) => c.id === id).title;
    chatView.innerHTML = '';
    chatView.append(...rendered);
    chatView.scrollTop = chatView.scrollHeight;
}

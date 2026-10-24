export enum CommandType_T { // CommandName-e.dat IDs used by FL2GameData::GetCommandType.
    loc = 0,
    sit = 4,
    stand = 5,
    walk = 6,
    run = 7,
    attack = 8,
    attackforce = 9,
    attackstand = 10,
    trade = 11,
    target = 12,
    targetnext = 13,
    pickup = 14,
    assist = 15,
    Invite = 16,
    Leave = 17,
    Dismiss = 18,
    vendor = 19,
    partymatching = 20,
    socialhello = 21,
    socialvictory = 22,
    socialcharge = 23,
    useskill = 24,
    useskillforce = 25,
    useskillstand = 26,
    useshortcut = 27,
    useshortcutforce = 28,
    useshortcutstand = 29,
    friendinvite = 36,
    friendlist = 37,
    frienddel = 38,
    buy = 39,
    blocklist = 43,
    block = 44,
    unblock = 45,
    socialno = 46,
    socialyes = 47,
    socialbow = 48,
    socialunaware = 49,
    socialwaitinga = 50,
    sociallaugh = 51,
    unstuck = 52,
    socialapplause = 54,
    socialdance = 55,
    socialsad = 56,
    sitstand = 57,
    evaluate = 75,
    delay = 76,
    Time = 77,
    allblock = 78,
    allunblock = 79,
    partyinfo = 81,
    changepartyleader = 85,
    enemylist = 88,
    attackerlist = 89,
    clanwarlist = 90,
    channeldelete = 93,
    channelleave = 96,
    channelinfo = 97,
    clanpenalty = 100,
    start_videorecording = 103,
    end_videorecording = 104,
    startend_videorecording = 105,
    "View Current Results" = 109,
}

export enum ActionType_T { // ActionName-e.dat macro command IDs.
    attack = 2,
    trade = 3,
    targetnext = 4,
    Pickup = 5,
    assist = 6,
    partyinvite = 7,
    partyleave = 8,
    partydismiss = 9,
    vendor = 10,
    partymatching = 11,
    petpickup = 18,
    buy = 28,
    commend = 40,
    leaderchange = 50,
    recstartstop = 55,
    invitechannel = 56,
}

function getCommandTokens(text: string) {
    const tokens: string[] = [];
    let token = "", depth = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === "[") depth++;
        else if (char === "]") {
            depth--;
            if (token) { tokens.push(token); token = ""; }
        } else if (depth === 0 && " \u3000\n\t\r={}$".includes(char)) {
            if (token) { tokens.push(token); token = ""; }
        } else token += char;
    }
    if (token) tokens.push(token);

    return tokens;
}

export default getCommandTokens;

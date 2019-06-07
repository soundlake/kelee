'use strict';

const total_todo = 15000;
const date_first = new Date('2019. 6. 3');
const date_last = new Date('2019. 7. 31');
const today = new Date(new Date().setHours(0, 0, 0, 0));
const local_db = {};
const remote_db_id = 'kelee';

/*
 * Date plugins
 */
Date.prototype.toString = function() {
  return this.toLocaleDateString('ko-KR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
Date.prototype.isOff = function() {
  var weekend = [0, 6];
  var belgian_holidays = [
    new Date('2019. 6. 10'),  // Whit Monday
    new Date('2019. 7. 11'),  // Flemish Community Holiday
    new Date('2019. 7. 21'),  // Independence Day
    new Date('2019. 8. 15'),  // Assumption
  ];
  return weekend.includes(this.getDay())
    || belgian_holidays.filter(d => d.getTime() == this.getTime()).length;
}
Date.prototype.asKey = function() {
  return this.toLocaleDateString('ko-KR');
}
Object.defineProperty(Date.prototype, 'timestamp', {
  get: function timestamp() {
    return Math.floor(this.getTime() / 1000);
  },
});

document.addEventListener('DOMContentLoaded', async () => {
  /*
   * init
   */
  var status =
    today < date_first ? '아직은 기다릴 때' :
    today >= date_last ? '이미 끝' :
    today.isOff() ? '오늘은 쉬는 날🌄🛀☀️🎈' : '🔥오늘도 성실히🔥';

  if (today < date_first || today >= date_last || today.isOff()) {
    document.querySelector('.daily').style.display = 'none';
    document.getElementById('form').style.display = 'none';
  } else {
    document.querySelector('.daily').style.display = 'block';
    document.getElementById('form').style.display = 'block';
  }

  document.getElementById('first').textContent = date_first;
  document.getElementById('last').textContent = date_last;

  document.getElementById('today').textContent = today;
  document.title = status;
  document.getElementById('status').textContent = status;

  document.querySelector('.total .todo').textContent = total_todo;

  /*
   * bootstrap
   */
  await firebase.auth().signInAnonymously();
  await bootstrap();
  update();

  /*
   * add form submit listener
   */
  document.getElementById('form').addEventListener('submit', event => {
    event.preventDefault();
    local_db[today.asKey()] = {
      dt: today,
      wc: Number(document.getElementById('wc').value),
    };
    firebase.firestore().collection(remote_db_id).doc(today.asKey())
      .update(local_db[today.asKey()])
      .then(() => {
        update();
      });
  });
});

const bootstrap = async () => {
  const db = firebase.firestore();
  const batch = db.batch();
  const querySnapshot = await db.collection(remote_db_id).get()
  if (!querySnapshot.empty) {
    return;
  }

  for (const d = new Date(date_first); d <= date_last; d.setDate(d.getDate() + 1)) {
    if (!d.isOff()) {
      const documentData = {
        dt: d,
        wc: 0,
      };
      batch.set(db.collection(remote_db_id).doc(d.asKey()), documentData);
      local_db[d.asKey()] = {
        dt: new Date(documentData.dt.seconds * 1000),
        wc: documentData.wc
      };
    }
  }
  await batch.commit();
}

const update = async () => {
  const db = firebase.firestore();

  // total
  let total_done = 0;
  if (Object.entries(local_db).length === 0) {
    // by this we can save up the google cloud quota
    const querySnapshot = await db.collection(remote_db_id).get();
    querySnapshot.forEach(queryDocumentSnapshot => {
      const documentData = queryDocumentSnapshot.data();
      total_done += documentData.wc;
      local_db[queryDocumentSnapshot.id] = {
        dt: new Date(documentData.dt.seconds * 1000),
        wc: documentData.wc
      };
    });
  } else {
    for (let documentData of Object.values(local_db)) {
      total_done += documentData.wc;
    }
  }
  document.querySelector('.total .done').textContent = total_done;
  document.querySelector('.total .percent').textContent = (total_done / total_todo * 100).toFixed(2);

  // days
  // now local_db is supposed to be warmed up
  const days_done = Object.values(local_db).filter(doc => doc.dt < today).length;
  const days_todo = Object.values(local_db).length;
  const days_rest = days_todo - days_done;
  document.querySelector('.days .done').textContent = days_done;
  document.querySelector('.days .todo').textContent = days_todo;
  document.querySelector('.days .rest').textContent = days_rest;

  // today
  db.collection(remote_db_id).doc(today.asKey()).get().then(queryDocumentSnapshot => {
    if (!queryDocumentSnapshot.exists) {
      return;
    }
    const daily_todo = Math.ceil(total_todo / days_todo / 10) * 10;
    const daily_done = queryDocumentSnapshot.data().wc;
    document.querySelector('input#wc').value = daily_done;
    document.querySelector('.daily .percent').textContent = (daily_done / daily_todo * 100).toFixed(2);
    document.querySelector('.daily .todo').textContent = daily_todo;
  });
}

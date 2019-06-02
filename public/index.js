'use strict';

const total_todo = 15000;
const date_first = new Date(2019, 6 - 1, 3);
const date_last = new Date(2019, 7 - 1, 31);
const today = new Date(new Date().setHours(0, 0, 0, 0));

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
    new Date(2019, 6 - 1, 10),  // Whit Monday
    new Date(2019, 7 - 1, 11),  // Flemish Community Holiday
    new Date(2019, 7 - 1, 21),  // Independence Day
    new Date(2019, 8 - 1, 15),  // Assumption
  ];
  return weekend.includes(this.getDay())
    || belgian_holidays.filter(d => d.getTime() == this.getTime()).length;
}
Date.prototype.asKey = function() {
  const year = `${this.getFullYear()}`;
  const month = `${this.getMonth()}`.padStart(2, '0');
  const date = `${this.getDate()}`.padStart(2, '0');
  return year + month + date;
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
    today.isOff() ? '오늘은 쉬는 날' : '오늘도 성실히';

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
  await bootstrap();

  /*
   * add form submit listener
   */
  document.getElementById('form').addEventListener('submit', event => {
    event.preventDefault();
    firebase.firestore().collection('kelee').doc(today.asKey())
      .update({
        dt: today,
        wc: Number(document.getElementById('wc').value),
      })
      .then(() => {
        update();
      });
  });

  /*
   * update data and view
   */
  await firebase.auth().signInAnonymously();
  update();
});

const bootstrap = async () => {
  const db = firebase.firestore();
  const batch = db.batch();
  const querySnapshot = await db.collection('kelee').get()
  if (!querySnapshot.empty) {
    return;
  }

  for (const d = new Date(date_first); d <= date_last; d.setDate(d.getDate() + 1)) {
    if (!d.isOff()) {
      batch.set(db.collection('kelee').doc(d.asKey()), {
        dt: d,
        wc: 0,
      });
    }
  }
  await batch.commit();
}

const update = async () => {
  const db = firebase.firestore();

  // days
  const days_done = (await db.collection('kelee').where('dt', '<', today).get()).size;
  const days_todo = (await db.collection('kelee').get()).size;
  const days_rest = days_todo - days_done;
  document.querySelector('.days .done').textContent = days_done;
  document.querySelector('.days .todo').textContent = days_todo;
  document.querySelector('.days .rest').textContent = days_rest;

  // total
  let total_done = 0;
  db.collection('kelee').get().then(querySnapshot => {
    querySnapshot.forEach(doc => {
      total_done += doc.data().wc;
    });
    document.querySelector('.total .done').textContent = total_done;
    document.querySelector('.total .percent').textContent = (total_done / total_todo * 100).toFixed(2);
  });

  // today
  db.collection('kelee').doc(today.asKey()).get().then(queryDocumentSnapshot => {
    if (!queryDocumentSnapshot.exists) {
      return;
    }
    const total_rest = total_todo - total_done;
    const daily_todo = Math.ceil(total_rest / (days_rest || 1));
    const daily_done = queryDocumentSnapshot.data().wc;
    document.querySelector('input#wc').value = daily_done;
    document.querySelector('.daily .percent').textContent = (daily_done / daily_todo * 100).toFixed(2);
    document.querySelector('.daily .todo').textContent = daily_todo;
  });
}

'use strict';

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
Object.defineProperty(Date.prototype, 'timestamp', {
  get: function timestamp() {
    return Math.floor(this.getTime() / 1000);
  },
});

document.addEventListener('DOMContentLoaded', async () => {
  /*
   * bootstrap
   */
  var g = {
    first: new Date(2019, 6 - 1, 3),
    last: new Date(2019, 7 - 1, 31),
    total: 15000,
    today: new Date(new Date().setHours(0, 0, 0, 0)),
  };

  var status =
    g.today < g.first ? '아직은 기다릴 때' :
    g.today >= g.last ? '이미 끝' :
    g.today.isOff() ? '오늘은 쉬는 날' : '오늘도 성실히';

  if (g.today < g.first || g.today >= g.last || g.today.isOff()) {
    g.daily = 0;
    document.querySelector('.daily').style.display = 'none';
    document.getElementById('form').style.display = 'none';
  } else {
    g.daily = 367;
    document.querySelector('.daily').style.display = 'block';
    document.getElementById('form').style.display = 'block';
  }

  document.getElementById('first').textContent = g.first;
  document.getElementById('last').textContent = g.last;
  document.querySelector('.days .done').textContent = countWorkingDays(g.first, g.today);
  document.querySelector('.days .todo').textContent = countWorkingDays(g.first, g.last);

  document.getElementById('today').textContent = g.today;
  document.title = status;
  document.getElementById('status').textContent = status;

  document.querySelector('.total .todo').textContent = g.total;
  document.querySelector('.daily .todo').textContent = g.daily;

  /*
   * async update
   */
  await firebase.auth().signInAnonymously();
  await update(g);

  /*
   * submit form
   */
  document.getElementById('submit').addEventListener('click', async (event) => {
    await handleSubmit(event);
    await update(g);
  });
  document.getElementById('wc').addEventListener('keyup', async (event) => {
    if ('Enter' == event.key) {
      await handleSubmit(event);
      await update(g);
    }
  });
});

var update = async g => {
  var tomorrow = new Date(g.today).setDate(g.today.getDate() + 1);
  var total = 0;
  var daily = 0;

  var querySnapshot = await firebase.firestore().collection('prog').get();
  querySnapshot.forEach(doc => {
    let d = doc.data();
    total += d.wc;
    if (g.today.timestamp <= d.time.seconds && d.time.seconds < tomorrow) {
      daily += d.wc;
    }
  });
  document.querySelector('.total .done').textContent = total;
  document.querySelector('.daily .done').textContent = daily;
  document.querySelector('.total .percent').textContent = (total / g.total * 100).toFixed(2);
  document.querySelector('.daily .percent').textContent = (daily / g.daily * 100).toFixed(2);
}

var handleSubmit = async event => {
  event.preventDefault();
  await firebase.firestore().collection('prog').add({
    time: new Date(),
    wc: Number(document.getElementById('wc').value),
  });
}

var countWorkingDays = (first, last) => {
  var count = 0;
  for (var d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    count += d.isOff() ? 0 : 1;
  }
  return count;
}

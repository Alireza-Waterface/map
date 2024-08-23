'use strict';

const form = document.querySelector('.form');
const formContainer = document.querySelector('.form__container');
const formError = document.querySelector('.form__error');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const workoutDeleteBtn = document.querySelector('.workout__delete--btn');
const controllers = document.querySelectorAll('.control');
const clearBtn = document.querySelector('.workouts__clear');

console.clear();

class Workout {
  date = new Date();
  id = (`${Date.now()}`);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // min
  }

  _setDesc() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.desc = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDesc();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDesc();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    this._getPosition();

    // Load data from local storage
    this._getLocalStorage();

    // Event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    form.addEventListener('reset', this._hideForm);
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveOrDelete.bind(this));
    controllers.forEach(cnt => cnt.addEventListener('change', this._controller.bind(this)));
    clearBtn.addEventListener('click', this._clearWorkouts.bind(this));
  }

  _clearWorkouts() {
    const workouts = document.querySelectorAll('.workout');
    this._toggleControls('hide');
    if(!workouts.length) return;

    let i = 0;
    const removeWorkouts = setInterval(() => {
      workouts[i].style.transform = 'translateX(-101%)';
      i++;
      if(i >= workouts.length) clearInterval(removeWorkouts);
    }, 100);

    const deleteAll = setTimeout(() => {
      workouts.forEach(item => item.remove());
      clearTimeout(deleteAll);
    }, (workouts.length + 1) * 100);

    localStorage.removeItem('workouts');
    this.#map?.eachLayer(layer => {if(layer instanceof L.Marker) layer?.remove()});
  }

  _toggleControls(state = 'show') {
    if(state == 'hide') document.querySelector('.controls').classList.add('hide');
    if(state == 'show') document.querySelector('.controls').classList.remove('hide');
  }

  _controller(e) {
    const hideWorkouts = type => {
      document.querySelectorAll('.workout').forEach(item => {
        item.classList.remove('d-none');
        if(!item.classList.contains(`workout--${type}`)) {
          item.classList.add('d-none');
        }
      });
    }
    const showAllWorkouts = () => document.querySelectorAll('.workout').forEach(item => item.classList.remove('d-none'));
    const reCreate = arr => {
      document.querySelectorAll('.workout').forEach(item => item.remove());
      arr.forEach(workout => this._renderWorkout(workout));
    }
    const filter = switchValue => {
      switch(switchValue) {
        case 'runnings':
          hideWorkouts('running');
          break;
        case 'cyclings':
          hideWorkouts('cycling');
          break;
        default:
          showAllWorkouts();
      }
    };

    const target = e.target.name;
    const value = e.target.value;

    if(target == 'sort') {
      if (value == 'date-desc') reCreate(this.#workouts.toReversed());
      else reCreate(this.#workouts);

      filter(document.getElementById('filter').value);
    } else if(target == 'filter') filter(value);
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), this._loadMap.bind(this));
    } else {
      alert('Please update your browser');
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords || {latitude: 33.507429978831546, longitude: 48.35188883095729};

    this.#map = L.map('map').setView([latitude, longitude], this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(workout => this._renderWorkoutMarker(workout));
  }

  _showForm(mapEv) {
    this.#mapEvent = mapEv;
    formError.classList.add('hidden');
    formContainer.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    formContainer.classList.add('hidden');
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // data validation

    // create running or cycling object based on activity
    switch(type) {
      case 'running':
        const cadence = +inputCadence.value;
        if(!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence)) return formError.classList.remove('hidden');

        workout = new Running([lat, lng], distance, duration, cadence);
        break;

      case 'cycling':
        const elevation = +inputElevation.value;
        if(!validInputs(distance, duration, elevation) || !allPositive(distance, duration)) return formError.classList.remove('hidden');

        workout = new Cycling([lat, lng], distance, duration, elevation);
        break;

      default:
        return;
    }

    // add new object to workout array
    this.#workouts.push(workout);

    // render workout on map as marker
    this._renderWorkoutMarker(workout);

    // render workout on list
    this._renderWorkout(workout);

    // hide form + clearing inputs
    this._hideForm();

    // Save to local storage
    this._setLocalStorage();

    this._toggleControls();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
    .addTo(this.#map)
    .bindPopup(L.popup({
      maxWidth: 250,
      minWidth: 100,
      autoClose: false,
      closeOnClick: false,
      className: `${workout.type}-popup`,
    }))
    .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.desc}`)
    .openPopup();
  }

  _renderWorkout(workout) {
    const li = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class="confirm__delete">
          <button class="btn confirm">Confirm</button>
          <button class="btn cancel">Cancel</button>
        </div>
        <div class="top">
          <h2 class="workout__title">${workout.desc}</h2>
            <button class="workout__delete--btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi      bi-trash3" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
              </svg>
            </button>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        ${workout.type === 'running' ?
        `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace?.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
          </li>
        `
        :
        `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed?.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
          </li>
        `
        }
    `;

    containerWorkouts.insertAdjacentHTML('beforeend', li);
  }

  _moveOrDelete(e) {
    const deleteBtn = e.target.closest('.workout__delete--btn');
    if(deleteBtn) {
      deleteBtn.parentElement.parentElement.children[0].style.left = 0; // Delete or cancel btns container ('.confirm__delete')
      return;
    }

    const confirmDelete = e.target.closest('.confirm');
    if(confirmDelete) {
      const workoutEl = e.target.closest('.workout');
      workoutEl.style.transform = 'translateX(-100%)';

      setTimeout(() => {
        workoutEl.remove();
        this._deleteWorkout(workoutEl.dataset.id);
      }, 200);

      return;
    }

    const cancelDelete = e.target.closest('.cancel');
    if(cancelDelete) {
      cancelDelete.closest('.confirm__delete').style.left = '-101%';
      return;
    }

    const backdrop = e.target.closest('.confirm__delete');
    if(backdrop) {
      backdrop.style.left = '-101%';
      return;
    }

    const workoutEl = e.target.closest('.workout');
    if(workoutEl) {
      const workout = this.#workouts.find(workout => workout.id === workoutEl.dataset.id);
      this.#map.setView(workout.coords, this.#mapZoomLevel, {
        animate: true,
        pan: {
          duration: 1,
        },
      });
      return;
    }
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if(!data || !data.length) return;

    this._toggleControls();
    this.#workouts = data;
    this.#workouts.forEach(workout => this._renderWorkout(workout));
  }

  _deleteWorkout(id) {
    const workout = this.#workouts.find(item => item.id === id);
    this.#workouts = this.#workouts.filter(item => item.id !== id);
    if(!this.#workouts.length) this._toggleControls('hide');
    this.#map?.eachLayer(layer => {
      if (
        layer instanceof L.Marker &&
        layer?.getLatLng().equals(workout.coords)
      ) layer?.remove();
    });
    this._setLocalStorage();
  }
}

const app = new App();
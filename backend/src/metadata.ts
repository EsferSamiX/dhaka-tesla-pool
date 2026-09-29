/* eslint-disable */
export default async () => {
  const t = {
    ['./auth/dto/auth.dto.js']: await import('./auth/dto/auth.dto.js'),
  };
  return {
    '@nestjs/swagger': {
      models: [
        [
          import('./auth/dto/auth.dto.js'),
          {
            VehicleDto: {
              name: { required: true, type: () => String, maxLength: 50 },
              plateNumber: {
                required: true,
                type: () => String,
                pattern: '^[A-Z0-9-]{1,20}$',
              },
              capacity: {
                required: true,
                type: () => Number,
                minimum: 1,
                maximum: 6,
              },
            },
            SignUpDto: {
              name: { required: true, type: () => String, maxLength: 100 },
              email: {
                required: true,
                type: () => String,
                maxLength: 255,
                format: 'email',
              },
              password: {
                required: true,
                type: () => String,
                minLength: 8,
                maxLength: 72,
              },
              role: { required: true, enum: ['PASSENGER', 'DRIVER'] },
              vehicle: {
                required: false,
                type: () => t['./auth/dto/auth.dto.js'].VehicleDto,
                description:
                  'Required for drivers, not allowed for passengers (checked in the service).',
              },
            },
            SignInDto: {
              email: { required: true, type: () => String, format: 'email' },
              password: { required: true, type: () => String, maxLength: 72 },
            },
          },
        ],
        [
          import('./zones/dto/trip.dto.js'),
          {
            TripDto: {
              pickupZone: {
                required: true,
                type: () => String,
                pattern: '^[A-Z0-9]{3}$',
              },
              destinationZone: {
                required: true,
                type: () => String,
                pattern: '^[A-Z0-9]{3}$',
              },
              seats: { required: true, type: () => Number, minimum: 1 },
            },
          },
        ],
        [
          import('./rides/dto/ride.dto.js'),
          {
            CreateRideDto: {
              pickupNote: {
                required: false,
                type: () => String,
                description:
                  'Free text for the driver, e.g. "Road 11, near the mosque".',
                maxLength: 200,
              },
            },
            CancelRideDto: {
              reason: { required: false, type: () => String, maxLength: 200 },
            },
            PaginationDto: {
              page: {
                required: true,
                type: () => Object,
                default: 1,
                minimum: 1,
              },
              limit: {
                required: true,
                type: () => Object,
                default: 20,
                minimum: 1,
                maximum: 50,
              },
            },
          },
        ],
        [
          import('./driver/dto/driver.dto.js'),
          {
            SetStatusDto: { isOnline: { required: true, type: () => Boolean } },
            CancelPoolDto: {
              reason: { required: false, type: () => String, maxLength: 200 },
            },
          },
        ],
      ],
      controllers: [
        [
          import('./auth/auth.controller.js'),
          {
            AuthController: {
              signUp: { type: Object },
              signIn: { type: Object },
              signOut: {},
              me: { type: Object },
            },
          },
        ],
        [
          import('./zones/zones.controller.js'),
          { ZonesController: { list: { type: [Object] } } },
        ],
        [
          import('./driver/driver.controller.js'),
          {
            DriverController: {
              setStatus: {},
              requests: { type: [Object] },
              accept: { type: Object },
              pool: { type: Object },
              arrive: { type: Object },
              start: { type: Object },
              complete: { type: Object },
              cancel: { type: Object },
              history: {},
            },
          },
        ],
        [
          import('./fares/fares.controller.js'),
          { FaresController: { estimate: { type: Object } } },
        ],
        [
          import('./health/health.controller.js'),
          {
            HealthController: {
              check: {
                summary:
                  '200 when the API and database are both reachable, 503 otherwise.',
                type: Object,
              },
            },
          },
        ],
        [
          import('./rides/rides.controller.js'),
          {
            RidesController: {
              request: { type: Object },
              active: { type: Object },
              history: {},
              findOne: { type: Object },
              cancel: { type: Object },
            },
          },
        ],
      ],
    },
  };
};

import { google } from 'googleapis';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

/**
 * Google Calendar Service
 * Check availability and schedule appointments
 */

class CalendarService {
  constructor() {
    if (!config.googleWorkspace.clientId || !config.googleWorkspace.clientSecret) {
      logger.warn('Google Workspace credentials not configured');
      this.calendar = null;
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      config.googleWorkspace.clientId,
      config.googleWorkspace.clientSecret,
      config.googleWorkspace.redirectUri
    );

    if (config.googleWorkspace.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.googleWorkspace.refreshToken,
      });
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    logger.info('Google Calendar service initialized');
  }

  /**
   * List upcoming events
   */
  async listEvents(options = {}) {
    if (!this.calendar) {
      throw new Error('Calendar service not initialized');
    }

    try {
      const {
        calendarId = 'primary',
        timeMin = new Date().toISOString(),
        timeMax = null,
        maxResults = 10,
      } = options;

      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      logger.error('Failed to list calendar events:', error);
      throw error;
    }
  }

  /**
   * Get event details
   */
  async getEvent(eventId, calendarId = 'primary') {
    if (!this.calendar) {
      throw new Error('Calendar service not initialized');
    }

    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Check availability for a time range
   */
  async checkAvailability(startTime, endTime, calendarId = 'primary') {
    if (!this.calendar) {
      throw new Error('Calendar service not initialized');
    }

    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startTime,
          timeMax: endTime,
          items: [{ id: calendarId }],
        },
      });

      const busy = response.data.calendars[calendarId].busy || [];

      return {
        available: busy.length === 0,
        busySlots: busy,
      };
    } catch (error) {
      logger.error('Failed to check availability:', error);
      throw error;
    }
  }

  /**
   * Find available time slots
   */
  async findAvailableSlots(date, duration = 60, calendarId = 'primary') {
    try {
      // Set business hours (9 AM - 6 PM)
      const startHour = 9;
      const endHour = 18;

      const dayStart = new Date(date);
      dayStart.setHours(startHour, 0, 0, 0);

      const dayEnd = new Date(date);
      dayEnd.setHours(endHour, 0, 0, 0);

      // Get busy periods for the day
      const { busySlots } = await this.checkAvailability(
        dayStart.toISOString(),
        dayEnd.toISOString(),
        calendarId
      );

      // Generate time slots
      const slots = [];
      let currentTime = new Date(dayStart);

      while (currentTime < dayEnd) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);

        if (slotEnd > dayEnd) break;

        // Check if slot overlaps with busy periods
        const isAvailable = !busySlots.some(busy => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);

          return (
            (currentTime >= busyStart && currentTime < busyEnd) ||
            (slotEnd > busyStart && slotEnd <= busyEnd) ||
            (currentTime <= busyStart && slotEnd >= busyEnd)
          );
        });

        if (isAvailable) {
          slots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString(),
            available: true,
          });
        }

        // Move to next slot (30 min intervals)
        currentTime = new Date(currentTime.getTime() + 30 * 60000);
      }

      return slots;
    } catch (error) {
      logger.error('Failed to find available slots:', error);
      throw error;
    }
  }

  /**
   * Create event
   */
  async createEvent(event, calendarId = 'primary') {
    if (!this.calendar) {
      throw new Error('Calendar service not initialized');
    }

    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      logger.info('Event created', {
        eventId: response.data.id,
        summary: response.data.summary,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create event:', error);
      throw error;
    }
  }

  /**
   * Get today's schedule summary
   */
  async getTodaySchedule() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = await this.listEvents({
      timeMin: today.toISOString(),
      timeMax: tomorrow.toISOString(),
    });

    return events.map(event => ({
      summary: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      attendees: event.attendees?.length || 0,
    }));
  }
}

// Singleton instance
const calendarService = new CalendarService();

export default calendarService;
